package handlers

import (
	"sort"
	"strconv"
	"strings"

	t "speakeasy-irgo/templates"

	"github.com/stukennedy/irgo/pkg/router"
)

type HttpLog = t.HttpLog
type Tag = t.Tag

var facets = []string{"method", "status", "domain", "path"}

var logs = []HttpLog{
	{ID: "1", Method: "GET", Path: "/", StatusCode: 200, Domain: "example.com", Timestamp: "2026-02-18T06:00:01Z", DurationMs: 12},
	{ID: "2", Method: "POST", Path: "/api/v1/users", StatusCode: 201, Domain: "example.com", Timestamp: "2026-02-18T06:00:02Z", DurationMs: 45},
	{ID: "3", Method: "GET", Path: "/api/v1/users/1", StatusCode: 200, Domain: "example.com", Timestamp: "2026-02-18T06:00:03Z", DurationMs: 8},
	{ID: "4", Method: "DELETE", Path: "/api/v1/users/1", StatusCode: 204, Domain: "example.com", Timestamp: "2026-02-18T06:00:04Z", DurationMs: 22},
	{ID: "5", Method: "GET", Path: "/api/v1/users/2", StatusCode: 404, Domain: "example.com", Timestamp: "2026-02-18T06:00:05Z", DurationMs: 5},
	{ID: "6", Method: "GET", Path: "/api/v1/users/3", StatusCode: 404, Domain: "example.com", Timestamp: "2026-02-18T06:00:06Z", DurationMs: 4},
	{ID: "7", Method: "GET", Path: "/api/v1/users/4", StatusCode: 404, Domain: "example.com", Timestamp: "2026-02-18T06:00:07Z", DurationMs: 6},
	{ID: "8", Method: "GET", Path: "/api/v1/users/5", StatusCode: 404, Domain: "example.com", Timestamp: "2026-02-18T06:00:08Z", DurationMs: 3},
	{ID: "9", Method: "GET", Path: "/", StatusCode: 200, Domain: "foo.com", Timestamp: "2026-02-18T06:00:09Z", DurationMs: 15},
	{ID: "10", Method: "GET", Path: "/api/v1/ads", StatusCode: 501, Domain: "google.com", Timestamp: "2026-02-18T06:00:10Z", DurationMs: 120},
	{ID: "11", Method: "GET", Path: "/search", StatusCode: 200, Domain: "google.com", Timestamp: "2026-02-18T06:00:11Z", DurationMs: 88},
	{ID: "12", Method: "GET", Path: "/api/v1/users", StatusCode: 500, Domain: "speakeasy.com", Timestamp: "2026-02-18T06:00:12Z", DurationMs: 250},
	{ID: "13", Method: "PUT", Path: "/api/v1/users/1", StatusCode: 200, Domain: "example.com", Timestamp: "2026-02-18T06:01:01Z", DurationMs: 18},
	{ID: "14", Method: "PATCH", Path: "/api/v1/users/2", StatusCode: 200, Domain: "example.com", Timestamp: "2026-02-18T06:01:02Z", DurationMs: 14},
	{ID: "15", Method: "POST", Path: "/api/v1/orders", StatusCode: 201, Domain: "speakeasy.com", Timestamp: "2026-02-18T06:01:03Z", DurationMs: 67},
	{ID: "16", Method: "GET", Path: "/api/v1/orders", StatusCode: 200, Domain: "speakeasy.com", Timestamp: "2026-02-18T06:01:04Z", DurationMs: 34},
	{ID: "17", Method: "DELETE", Path: "/api/v1/orders/1", StatusCode: 204, Domain: "speakeasy.com", Timestamp: "2026-02-18T06:01:05Z", DurationMs: 11},
	{ID: "18", Method: "GET", Path: "/health", StatusCode: 200, Domain: "foo.com", Timestamp: "2026-02-18T06:01:06Z", DurationMs: 2},
	{ID: "19", Method: "POST", Path: "/api/v1/auth", StatusCode: 401, Domain: "google.com", Timestamp: "2026-02-18T06:01:07Z", DurationMs: 55},
	{ID: "20", Method: "GET", Path: "/api/v1/products", StatusCode: 200, Domain: "example.com", Timestamp: "2026-02-18T06:01:08Z", DurationMs: 42},
}

func getFieldValue(log HttpLog, facet string) string {
	switch facet {
	case "method":
		return log.Method
	case "status":
		return strconv.Itoa(log.StatusCode)
	case "domain":
		return log.Domain
	case "path":
		return log.Path
	}
	return ""
}

func getUniqueValues(facet, prefix string, activeTags []Tag) []string {
	filtered := filterLogs(activeTags)
	seen := map[string]bool{}
	var values []string
	for _, log := range filtered {
		val := getFieldValue(log, facet)
		if val == "" || seen[val] {
			continue
		}
		if prefix != "" && !strings.Contains(strings.ToLower(val), strings.ToLower(prefix)) {
			continue
		}
		seen[val] = true
		values = append(values, val)
	}
	sort.Strings(values)
	return values
}

func filterLogs(tags []Tag) []HttpLog {
	if len(tags) == 0 {
		return logs
	}
	var result []HttpLog
	for _, log := range logs {
		match := true
		for _, tag := range tags {
			if getFieldValue(log, tag.Facet) != tag.Value {
				match = false
				break
			}
		}
		if match {
			result = append(result, log)
		}
	}
	return result
}

func parseTags(tagsStr string) []Tag {
	if tagsStr == "" {
		return nil
	}
	var tags []Tag
	for _, s := range strings.Split(tagsStr, "|") {
		parts := strings.SplitN(s, ":", 2)
		if len(parts) == 2 {
			tags = append(tags, Tag{Facet: parts[0], Value: parts[1]})
		}
	}
	return tags
}

func AllLogs() []HttpLog {
	return logs
}

func Mount(r *router.Router) {
	// Suggest facets/values
	r.DSGet("/api/suggest", func(ctx *router.Context) error {
		var signals struct {
			Query string `json:"query"`
			Tags  string `json:"tags"`
		}
		ctx.ReadSignals(&signals)

		activeTags := parseTags(signals.Tags)
		query := strings.TrimSpace(signals.Query)
		sse := ctx.SSE()

		if query == "" {
			return sse.PatchTempl(t.FacetList(facets, ""))
		}

		if idx := strings.Index(query, ":"); idx > 0 {
			facet := strings.ToLower(query[:idx])
			prefix := ""
			if idx+1 < len(query) {
				prefix = query[idx+1:]
			}
			valid := false
			for _, f := range facets {
				if f == facet {
					valid = true
					break
				}
			}
			if !valid {
				return sse.PatchTempl(t.NoResults("Unknown facet: " + facet))
			}
			values := getUniqueValues(facet, prefix, activeTags)
			if len(values) == 0 {
				return sse.PatchTempl(t.NoResults("No matching values"))
			}
			return sse.PatchTempl(t.ValueList(facet, values))
		}

		var matching []string
		for _, f := range facets {
			if strings.Contains(f, strings.ToLower(query)) {
				matching = append(matching, f)
			}
		}
		if len(matching) == 0 {
			return sse.PatchTempl(t.NoResults("No matching facets"))
		}
		return sse.PatchTempl(t.FacetList(matching, query))
	})

	// Refresh log table
	r.DSGet("/api/logs", func(ctx *router.Context) error {
		var signals struct {
			Tags string `json:"tags"`
		}
		ctx.ReadSignals(&signals)
		activeTags := parseTags(signals.Tags)
		filtered := filterLogs(activeTags)
		return ctx.SSE().PatchTempl(t.LogTable(filtered))
	})
}
