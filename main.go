package main

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"strings"
	"time"
)

const (
	serverAddr       = "localhost:8080"
	pythonServiceURL = "http://localhost:5001/process"
)

var defaultEngines = []string{"google", "duckduckgo", "bing"}

//go:embed ui/*
var uiFiles embed.FS

type SearchRequest struct {
	Query    string   `json:"query"`
	Engines  []string `json:"engines"`
	Page     int      `json:"page"`
	Language string   `json:"language"`
}

type SearchResult struct {
	Title       string  `json:"title"`
	URL         string  `json:"url"`
	Description string  `json:"description"`
	Engine      string  `json:"engine"`
	Score       float64 `json:"score"`
}

type SearchResponse struct {
	Results      []SearchResult `json:"results"`
	Suggestions  []string       `json:"suggestions"`
	SearchTime   float64        `json:"search_time"`
	TotalResults int            `json:"total_results"`
}

type processRequest struct {
	Query   string         `json:"query"`
	Results []SearchResult `json:"results"`
}

type processResponse struct {
	Results     []SearchResult `json:"results"`
	Suggestions []string       `json:"suggestions"`
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/search", handleSearch)

	uiFS, err := fs.Sub(uiFiles, "ui")
	if err != nil {
		log.Fatalf("unable to load UI assets: %v", err)
	}
	mux.Handle("/", http.FileServer(http.FS(uiFS)))

	server := &http.Server{
		Addr:              serverAddr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("Go speed layer running at http://%s", serverAddr)
	log.Fatal(server.ListenAndServe())
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON payload", http.StatusBadRequest)
		return
	}

	req.Query = strings.TrimSpace(req.Query)
	if req.Query == "" {
		http.Error(w, "query is required", http.StatusBadRequest)
		return
	}
	if len(req.Engines) == 0 {
		req.Engines = defaultEngines
	}
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Language == "" {
		req.Language = "en"
	}

	start := time.Now()

	// Data flow: fan-out concurrent engine queries, collect raw results,
	// then send JSON to the Python quality layer for processing.
	rawResults := gatherResults(req)
	processedResults, suggestions, err := callPythonQuality(r.Context(), req.Query, rawResults)
	if err != nil {
		http.Error(w, fmt.Sprintf("python service error: %v", err), http.StatusBadGateway)
		return
	}

	response := SearchResponse{
		Results:      processedResults,
		Suggestions:  suggestions,
		SearchTime:   time.Since(start).Seconds(),
		TotalResults: len(processedResults),
	}

	writeJSON(w, response)
}

func callPythonQuality(ctx context.Context, query string, results []SearchResult) ([]SearchResult, []string, error) {
	payload := processRequest{Query: query, Results: results}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, pythonServiceURL, bytes.NewReader(body))
	if err != nil {
		return nil, nil, err
	}
	request.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 6 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		message, _ := io.ReadAll(response.Body)
		if len(message) == 0 {
			message = []byte(response.Status)
		}
		return nil, nil, fmt.Errorf("status %d: %s", response.StatusCode, strings.TrimSpace(string(message)))
	}

	var processed processResponse
	if err := json.NewDecoder(response.Body).Decode(&processed); err != nil {
		return nil, nil, err
	}

	return processed.Results, processed.Suggestions, nil
}

func writeJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(payload); err != nil {
		http.Error(w, "unable to encode response", http.StatusInternalServerError)
	}
}
