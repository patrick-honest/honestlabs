package bigquery

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strings"

	"cloud.google.com/go/bigquery"
	"google.golang.org/api/iterator"
)

// CustomerInfo holds customer details looked up from BigQuery.
type CustomerInfo struct {
	UserID      string
	URN         string
	LocAcct     string
	CardBrand   string // LC, VS, MC, UP
	CardProduct string // C=Classic, G=Gold, P=Platinum
}

// Client wraps the BigQuery SDK for customer lookups.
type Client struct {
	projectID string
	bqClient  *bigquery.Client
	logger    *slog.Logger
}

// userID patterns: user_id: XXX, userId: XXX, user_id=XXX, userId=XXX, and standalone UUIDs.
var userIDPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)user[_-]?id\s*[:=]\s*([0-9a-fA-F-]{36})`),
	regexp.MustCompile(`(?i)user[_-]?id\s*[:=]\s*(\S+)`),
	regexp.MustCompile(`\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b`),
}

// NewClient creates a new BigQuery client.
func NewClient(ctx context.Context, projectID string, logger *slog.Logger) (*Client, error) {
	bqClient, err := bigquery.NewClient(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("create bigquery client: %w", err)
	}

	return &Client{
		projectID: projectID,
		bqClient:  bqClient,
		logger:    logger,
	}, nil
}

// Close closes the underlying BigQuery client.
func (c *Client) Close() error {
	return c.bqClient.Close()
}

// ExtractUserIDs extracts user IDs from message text using regex patterns.
func ExtractUserIDs(text string) []string {
	seen := make(map[string]bool)
	var ids []string

	for _, pat := range userIDPatterns {
		matches := pat.FindAllStringSubmatch(text, -1)
		for _, m := range matches {
			if len(m) < 2 {
				continue
			}
			id := strings.TrimSpace(m[1])
			if id == "" || seen[id] {
				continue
			}
			seen[id] = true
			ids = append(ids, id)
		}
	}

	return ids
}

// locRow represents a row from cms_line_of_credit.
type locRow struct {
	ExternalID string `bigquery:"external_id"`
}

// cardRow represents a row from principal_card_updates.
type cardRow struct {
	URN         string `bigquery:"p9_dw004_urn"`
	CardBrand   string `bigquery:"fx_dw005_crd_brn"`
	CardProduct string `bigquery:"fx_dw005_crd_prd"`
}

// LookupCustomer queries BigQuery for customer information given a user ID.
// Flow:
//  1. Query cms_line_of_credit WHERE user_id = ? to get external_id (loc_acct)
//  2. Query principal_card_updates WHERE p9_dw004_loc_acct = ? ORDER BY update_timestamp DESC LIMIT 1
func (c *Client) LookupCustomer(ctx context.Context, userID string) (*CustomerInfo, error) {
	c.logger.Info("looking up customer in BigQuery", "user_id", userID)

	// Step 1: Get loc_acct (external_id) from cms_line_of_credit.
	locQuery := c.bqClient.Query(
		"SELECT external_id FROM `storage-58f5a02c.mart_growthbook.cms_line_of_credit` WHERE user_id = @user_id LIMIT 1",
	)
	locQuery.Parameters = []bigquery.QueryParameter{
		{Name: "user_id", Value: userID},
	}

	locIter, err := locQuery.Read(ctx)
	if err != nil {
		return nil, fmt.Errorf("query cms_line_of_credit: %w", err)
	}

	var loc locRow
	err = locIter.Next(&loc)
	if err == iterator.Done {
		c.logger.Info("no LOC record found for user", "user_id", userID)
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read cms_line_of_credit row: %w", err)
	}

	locAcct := loc.ExternalID
	c.logger.Info("found LOC account", "user_id", userID, "loc_acct", locAcct)

	info := &CustomerInfo{
		UserID:  userID,
		LocAcct: locAcct,
	}

	// Step 2: Get card details from principal_card_updates.
	cardQuery := c.bqClient.Query(
		"SELECT p9_dw004_urn, fx_dw005_crd_brn, fx_dw005_crd_prd " +
			"FROM `storage-58f5a02c.mart_finexus.principal_card_updates` " +
			"WHERE p9_dw004_loc_acct = @loc_acct " +
			"ORDER BY update_timestamp DESC LIMIT 1",
	)
	cardQuery.Parameters = []bigquery.QueryParameter{
		{Name: "loc_acct", Value: locAcct},
	}

	cardIter, err := cardQuery.Read(ctx)
	if err != nil {
		c.logger.Warn("failed to query principal_card_updates", "error", err, "loc_acct", locAcct)
		return info, nil
	}

	var card cardRow
	err = cardIter.Next(&card)
	if err == iterator.Done {
		c.logger.Info("no card record found for LOC account", "loc_acct", locAcct)
		return info, nil
	}
	if err != nil {
		c.logger.Warn("failed to read principal_card_updates row", "error", err)
		return info, nil
	}

	info.URN = card.URN
	info.CardBrand = card.CardBrand
	info.CardProduct = card.CardProduct

	c.logger.Info("found card details",
		"user_id", userID,
		"urn", info.URN,
		"card_brand", info.CardBrand,
		"card_product", info.CardProduct,
	)

	return info, nil
}
