package main

import (
	"fmt"
	"net/url"
	"strings"
	"sync"
)

func gatherResults(req SearchRequest) []SearchResult {
	var wg sync.WaitGroup
	resultsChan := make(chan []SearchResult, len(req.Engines))

	for _, engine := range req.Engines {
		engineName := strings.ToLower(strings.TrimSpace(engine))
		if engineName == "" {
			continue
		}
		wg.Add(1)
		go func(name string) {
			defer wg.Done()
			resultsChan <- searchEngine(name, req.Query, req.Page, req.Language)
		}(engineName)
	}

	wg.Wait()
	close(resultsChan)

	var results []SearchResult
	for chunk := range resultsChan {
		results = append(results, chunk...)
	}

	return results
}

func searchEngine(engine string, query string, page int, language string) []SearchResult {
	titlePrefix := fmt.Sprintf("%s index", titleCase(engine))
	domain := fmt.Sprintf("%s.local", engine)
	queryEscaped := url.QueryEscape(query)

	return []SearchResult{
		{
			Title:       fmt.Sprintf("%s • overview for %s", titlePrefix, query),
			URL:         fmt.Sprintf("https://%s/search?q=%s&page=%d&lang=%s", domain, queryEscaped, page, language),
			Description: fmt.Sprintf("Local %s results covering %s with language %s.", titleCase(engine), query, strings.ToUpper(language)),
			Engine:      engine,
			Score:       0,
		},
		{
			Title:       fmt.Sprintf("%s • deep dive", titlePrefix),
			URL:         fmt.Sprintf("https://%s/article/%s?lang=%s", domain, queryEscaped, language),
			Description: fmt.Sprintf("Detailed analysis about %s surfaced by the %s engine.", query, titleCase(engine)),
			Engine:      engine,
			Score:       0,
		},
		{
			Title:       fmt.Sprintf("%s • latest updates", titlePrefix),
			URL:         fmt.Sprintf("https://%s/updates/%s?page=%d", domain, queryEscaped, page),
			Description: fmt.Sprintf("Latest local updates and references for %s.", query),
			Engine:      engine,
			Score:       0,
		},
	}
}

func titleCase(value string) string {
	if value == "" {
		return ""
	}
	if len(value) == 1 {
		return strings.ToUpper(value)
	}
	return strings.ToUpper(value[:1]) + value[1:]
}
