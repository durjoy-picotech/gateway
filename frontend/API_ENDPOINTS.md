# Payment Gateway Orchestration Platform - API Endpoints Documentation

This document outlines all the RESTful API endpoints that need to be developed for the Payment Gateway Orchestration Platform. Each endpoint includes request/response schemas, authentication requirements, and error codes.

## Table of Contents
- [Authentication](#authentication)
- [User Management](#user-management)
- [Partner Management](#partner-management)
- [Agent Management](#agent-management)
- [Merchant Management](#merchant-management)
- [Transaction Processing](#transaction-processing)
- [Settlement Management](#settlement-management)
- [Analytics & Reporting](#analytics--reporting)
- [Policy Management](#policy-management)
- [Automation & Jobs](#automation--jobs)
- [Notifications](#notifications)
- [Currency & FX Management](#currency--fx-management)
- [Channel & Routing Management](#channel--routing-management)

## Authentication

### POST /api/auth/login
Authenticate user and return JWT token.

**Request Body:**
```json
{
  "email": "string",
  "password": "string",
  "remember_me": "boolean"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": "string",
      "role": "SUPER_ADMIN|PARTNER|AGENT|MERCHANT",
      "name": "string",
      "email": "string",
      "phone": "string",
      "timezone": "string",
      "two_factor_enabled": "boolean",
      "created_at": "string",
      "partner_id": "string?",
      "agent_id": "string?"
    },
    "token": "string",
    "refresh_token": "string",
    "expires_in": "number"
  }
}
```

**Error Codes:**
- `400` - Invalid credentials
- `401` - Account disabled
- `429` - Too many login attempts

### POST /api/auth/refresh
Refresh JWT token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "string"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "string",
    "refresh_token": "string",
    "expires_in": "number"
  }
}
```

### POST /api/auth/logout
Invalidate current session.

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /api/auth/profile
Get current user profile information.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user_id": "string",
    "role": "SUPER_ADMIN|PARTNER|AGENT|MERCHANT",
    "name": "string",
    "email": "string",
    "phone": "string",
    "timezone": "string",
    "two_factor_enabled": "boolean",
    "created_at": "string",
    "partner_id": "string?",
    "agent_id": "string?"
  }
}
```

## User Management

### GET /api/users
List users with pagination and filtering.

**Query Parameters:**
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 20)
- `role` (string) - Filter by role
- `status` (string) - Filter by status
- `search` (string) - Search by name or email

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "user_id": "string",
        "role": "SUPER_ADMIN|PARTNER|AGENT|MERCHANT",
        "name": "string",
        "email": "string",
        "phone": "string",
        "timezone": "string",
        "two_factor_enabled": "boolean",
        "created_at": "string",
        "partner_id": "string?",
        "agent_id": "string?"
      }
    ],
    "pagination": {
      "page": "number",
      "limit": "number",
      "total": "number",
      "pages": "number"
    }
  }
}
```

### POST /api/users
Create new user.

**Request Body:**
```json
{
  "role": "SUPER_ADMIN|PARTNER|AGENT|MERCHANT",
  "name": "string",
  "email": "string",
  "phone": "string",
  "timezone": "string",
  "password": "string",
  "partner_id": "string?",
  "agent_id": "string?"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user_id": "string",
    "role": "SUPER_ADMIN|PARTNER|AGENT|MERCHANT",
    "name": "string",
    "email": "string",
    "phone": "string",
    "timezone": "string",
    "two_factor_enabled": "boolean",
    "created_at": "string",
    "partner_id": "string?",
    "agent_id": "string?"
  }
}
```

### GET /api/users/:id
Get user details by ID.

**Response (200):** Same as user object above.

### PUT /api/users/:id
Update user information.

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "timezone": "string",
  "two_factor_enabled": "boolean"
}
```

### DELETE /api/users/:id
Delete user account.

**Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### PUT /api/users/:id/password
Change user password.

**Request Body:**
```json
{
  "current_password": "string",
  "new_password": "string"
}
```

### PUT /api/users/:id/2fa
Enable/disable 2FA for user.

**Request Body:**
```json
{
  "enabled": "boolean"
}
```

## Partner Management

### GET /api/partners
List partners with pagination.

**Query Parameters:** Similar to users endpoint.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "partners": [
      {
        "partner_id": "string",
        "name": "string",
        "domain_branding": "string",
        "default_currency": "string",
        "enabled_currencies": ["string"],
        "settlement_policy": "object",
        "reserve_policy": "object",
        "kyc_policy": "boolean",
        "created_at": "string",
        "status": "ACTIVE|INACTIVE|SUSPENDED"
      }
    ],
    "pagination": "object"
  }
}
```

### POST /api/partners
Create new partner.

**Request Body:**
```json
{
  "name": "string",
  "domain_branding": "string",
  "default_currency": "string",
  "enabled_currencies": ["string"],
  "settlement_policy": "object",
  "reserve_policy": "object",
  "kyc_policy": "boolean"
}
```

### GET /api/partners/:id
Get partner details.

### PUT /api/partners/:id
Update partner information.

### DELETE /api/partners/:id
Delete partner.

### PUT /api/partners/:id/status
Update partner status.

**Request Body:**
```json
{
  "status": "ACTIVE|INACTIVE|SUSPENDED"
}
```

## Agent Management

### GET /api/agents
List agents with filtering.

**Query Parameters:**
- `partner_id` (string) - Filter by partner
- Other pagination params

### POST /api/agents
Create new agent.

**Request Body:**
```json
{
  "partner_id": "string",
  "parent_agent_id": "string?",
  "name": "string",
  "default_currency": "string",
  "allowed_sub_agents": "boolean"
}
```

### GET /api/agents/:id
Get agent details.

### PUT /api/agents/:id
Update agent information.

### DELETE /api/agents/:id
Delete agent.

### PUT /api/agents/:id/status
Update agent status.

## Merchant Management

### GET /api/merchants
List merchants with filtering.

**Query Parameters:**
- `agent_id` (string) - Filter by agent
- `status` (string) - Filter by status
- `kyb_status` (string) - Filter by KYB status

### POST /api/merchants
Create new merchant.

**Request Body:**
```json
{
  "agent_id": "string",
  "name": "string",
  "default_currency": "string",
  "enabled_currencies": ["string"],
  "settlement_terms": "string"
}
```

### GET /api/merchants/:id
Get merchant details.

### PUT /api/merchants/:id
Update merchant information.

### DELETE /api/merchants/:id
Delete merchant.

### PUT /api/merchants/:id/status
Update merchant status.

### PUT /api/merchants/:id/kyb
Update KYB status.

**Request Body:**
```json
{
  "kyb_status": "PENDING|APPROVED|REJECTED",
  "review_notes": "string?"
}
```

## Transaction Processing

### GET /api/transactions
List transactions with filtering.

**Query Parameters:**
- `merchant_id` (string)
- `status` (string)
- `channel_type` (string)
- `date_from` (string)
- `date_to` (string)
- `min_amount` (number)
- `max_amount` (number)

### GET /api/transactions/:id
Get transaction details.

### POST /api/pay/V2
Process payment transaction.

**Request Body:**
```json
{
  "merchant_id": "string",
  "amount": "number",
  "currency": "string",
  "channel_type": "CARD|BANK_TRANSFER|EWALLET|QR|CRYPTO",
  "customer_email": "string?",
  "metadata": "object?"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "txn_id": "string",
    "status": "PENDING|SUCCESS|FAILED|CANCELLED",
    "provider_alias": "string",
    "fx_rate": "number",
    "fee_breakdown": "object",
    "estimated_cost": "number",
    "routing_strategy": "string",
    "routing_reason": "string"
  }
}
```

### GET /api/pay/queryV2
Query payment status.

**Query Parameters:**
- `txn_id` (string)

### POST /api/defray/V2
Process payout transaction.

**Request Body:**
```json
{
  "merchant_id": "string",
  "amount": "number",
  "currency": "string",
  "channel_type": "BANK_TRANSFER|EWALLET|CRYPTO",
  "recipient_details": "object",
  "metadata": "object?"
}
```

### GET /api/defray/queryV2
Query payout status.

### GET /api/balance/V2
Get merchant balance.

**Query Parameters:**
- `merchant_id` (string)
- `currency` (string)

## Settlement Management

### GET /api/settlements
List settlements.

**Query Parameters:**
- `merchant_id` (string)
- `status` (string)
- `date_from` (string)
- `date_to` (string)

### GET /api/settlements/:id
Get settlement details.

### POST /api/settlements/batch
Create settlement batch.

**Request Body:**
```json
{
  "partner_id": "string",
  "settlement_date": "string",
  "cutoff_time": "string"
}
```

### POST /api/settlements/individual
Create individual settlement for Partner/Agent/Merchant.

**Request Body:**
```json
{
  "amount": "number",
  "currency": "string",
  "settlement_date": "string"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Settlement created successfully",
  "data": {
    "settlement_id": "string",
    "amount": "number",
    "currency": "string",
    "status": "PENDING",
    "settlement_date": "string",
    "held_balance": "number"
  }
}
```

### PUT /api/settlements/:id/status
Update settlement status.

**Request Body:**
```json
{
  "status": "PENDING|PROCESSING|COMPLETED|FAILED|CANCELLED",
  "failure_reason": "string?"
}
```

## Analytics & Reporting

### GET /api/analytics/dashboard
Get dashboard analytics data.

**Query Parameters:**
- `date_from` (string)
- `date_to` (string)
- `scope_type` (string) - SUPER_ADMIN|PARTNER|AGENT|MERCHANT
- `scope_id` (string)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kpis": {
      "volume": {
        "total": "number",
        "approved": "number",
        "declined": "number",
        "approvalRate": "number",
        "declineRate": "number"
      },
      "byChannelType": "object",
      "byMethod": "object",
      "byVariant": "object",
      "byProviderAlias": "object"
    },
    "fees": {
      "totalRevenue": "number",
      "revenueSplit": {
        "superAdmin": "number",
        "partners": "number",
        "agents": "number",
        "merchants": "number"
      },
      "feeBreakdown": {
        "gatewayFees": "number",
        "processingFees": "number",
        "fxFees": "number",
        "reserveFees": "number"
      }
    },
    "fxMargins": {
      "totalMargin": "number",
      "averageMarginBps": "number",
      "marginByCurrencyPair": "object",
      "marginTrend": "array"
    },
    "settlementPerformance": {
      "totalSettlements": "number",
      "successfulSettlements": "number",
      "failedSettlements": "number",
      "pendingSettlements": "number",
      "averageSettlementTime": "number",
      "settlementSuccessRate": "number",
      "settlementVolume": "number",
      "settlementFees": "number"
    },
    "reservesDepositsPenalties": {
      "totalReserves": "number",
      "availableReserves": "number",
      "heldReserves": "number",
      "deposits": "number",
      "penalties": "number",
      "reserveUtilization": "number",
      "reserveTrend": "array"
    },
    "bankReconciliation": {
      "totalTransactions": "number",
      "reconciledTransactions": "number",
      "unreconciledTransactions": "number",
      "reconciliationRate": "number",
      "discrepancies": "number",
      "discrepancyAmount": "number",
      "lastReconciliationDate": "string"
    },
    "notificationStats": {
      "totalSent": "number",
      "delivered": "number",
      "failed": "number",
      "deliveryRate": "number",
      "averageDeliveryTime": "number",
      "byType": "object"
    },
    "dateRange": {
      "start": "string",
      "end": "string"
    }
  }
}
```

### GET /api/analytics/export
Export analytics data.

**Query Parameters:**
- `format` (string) - CSV|PDF
- `date_from` (string)
- `date_to` (string)
- `scope_type` (string)
- `scope_id` (string)

## Policy Management

### GET /api/policies/reserve
List reserve policies.

### POST /api/policies/reserve
Create reserve policy.

**Request Body:**
```json
{
  "scope_type": "SUPER_ADMIN|PARTNER|AGENT|MERCHANT",
  "scope_id": "string",
  "enabled": "boolean",
  "hold_percentage": "number",
  "duration_days": "number",
  "release_frequency": "DAILY|WEEKLY|MONTHLY|ON_DEMAND",
  "release_threshold": "number?",
  "currency": "string"
}
```

### PUT /api/policies/reserve/:id
Update reserve policy.

### DELETE /api/policies/reserve/:id
Delete reserve policy.

### GET /api/policies/security-deposit
List security deposit policies.

### POST /api/policies/security-deposit
Create security deposit policy.

### GET /api/policies/penalty
List penalty policies.

### POST /api/policies/penalty
Create penalty policy.

### GET /api/policies/method
List method policies.

### POST /api/policies/method
Create method policy.

### GET /api/policies/operating-window
List operating windows.

### POST /api/policies/operating-window
Create operating window.

## Automation & Jobs

### GET /api/automation/jobs
List scheduled jobs.

### POST /api/automation/jobs
Create scheduled job.

**Request Body:**
```json
{
  "name": "string",
  "type": "RESERVE_RELEASE|PENALTY_ASSESSMENT|SETTLEMENT_BATCH|RECONCILIATION_IMPORT",
  "schedule_type": "CRON|INTERVAL|ONE_TIME",
  "cron_expression": "string?",
  "interval_seconds": "number?",
  "scope_type": "SUPER_ADMIN|PARTNER|AGENT|MERCHANT",
  "scope_id": "string",
  "config": "object"
}
```

### PUT /api/automation/jobs/:id
Update scheduled job.

### DELETE /api/automation/jobs/:id
Delete scheduled job.

### PUT /api/automation/jobs/:id/enable
Enable/disable job.

### GET /api/automation/jobs/executions
List job executions.

### GET /api/automation/jobs/executions/:id
Get job execution details.

### POST /api/automation/jobs/manual
Execute manual job.

### GET /api/automation/webhooks
List webhooks.

### POST /api/automation/webhooks
Create webhook.

**Request Body:**
```json
{
  "name": "string",
  "url": "string",
  "method": "POST|PUT|PATCH",
  "headers": "object",
  "timeout_seconds": "number",
  "retry_count": "number",
  "retry_delay_seconds": "number",
  "events": ["string"],
  "scope_type": "SUPER_ADMIN|PARTNER|AGENT|MERCHANT",
  "scope_id": "string"
}
```

### PUT /api/automation/webhooks/:id
Update webhook.

### DELETE /api/automation/webhooks/:id
Delete webhook.

### GET /api/automation/notifications
List notification configs.

### POST /api/automation/notifications
Create notification config.

**Request Body:**
```json
{
  "name": "string",
  "type": "LIMITS|LOW_DEPOSIT|SETTLEMENT_DELAY|SYSTEM_ALERT",
  "channels": ["EMAIL|SMS|WEBHOOK|IN_APP"],
  "recipients": ["string"],
  "conditions": "object",
  "template": "string",
  "scope_type": "SUPER_ADMIN|PARTNER|AGENT|MERCHANT",
  "scope_id": "string"
}
```

## Notifications

### GET /api/notifications
List user notifications.

**Query Parameters:**
- `page` (number)
- `limit` (number)
- `read` (boolean) - Filter by read status
- `type` (string) - Filter by type

### PUT /api/notifications/:id/read
Mark notification as read.

### PUT /api/notifications/read-all
Mark all notifications as read.

### DELETE /api/notifications/:id
Delete notification.

## Currency & FX Management

### GET /api/currencies
List available currencies.

### POST /api/currencies
Add new currency.

**Request Body:**
```json
{
  "code": "string",
  "name": "string",
  "symbol": "string",
  "type": "fiat|crypto",
  "precision": "number"
}
```

### PUT /api/currencies/:code/enable
Enable/disable currency.

### GET /api/fx/rates
Get current FX rates.

**Query Parameters:**
- `from_currency` (string)
- `to_currency` (string)

### POST /api/fx/rates/refresh
Refresh FX rates from sources.

### GET /api/fx/policies
List FX policies.

### POST /api/fx/policies
Create FX policy.

**Request Body:**
```json
{
  "scope_type": "SUPER_ADMIN|PARTNER|AGENT|MERCHANT",
  "scope_id": "string",
  "markup_bps": "number",
  "fixed_spread": "number",
  "rounding_mode": "BANKERS|HALF_UP|HALF_DOWN|TRUNCATE",
  "staleness_cap_minutes": "number",
  "weekend_mode": "FREEZE|EXTEND|MARKET",
  "enabled_sources": ["string"],
  "fallback_source": "string"
}
```

### GET /api/fx/sources
List FX sources.

### POST /api/fx/sources
Add FX source.

## Channel & Routing Management

### GET /api/channels
List payment channels.

### POST /api/channels
Create payment channel.

**Request Body:**
```json
{
  "code": "string",
  "name": "string",
  "method": "CARD|BANK_TRANSFER|EWALLET|QR|CRYPTO",
  "variants": ["string"]
}
```

### GET /api/routing/strategies
List routing strategies.

### POST /api/routing/strategies
Create routing strategy.

**Request Body:**
```json
{
  "name": "string",
  "type": "PRIORITY|WEIGHTED|CHEAPEST|FASTEST|FAILOVER",
  "config": {
    "providers": [
      {
        "provider_alias": "string",
        "priority": "number?",
        "weight": "number?",
        "max_amount": "number?",
        "min_amount": "number?"
      }
    ],
    "fallback_strategy": "string?",
    "timeout_ms": "number?",
    "retry_attempts": "number?"
  },
  "scope_type": "SUPER_ADMIN|PARTNER|AGENT|MERCHANT",
  "scope_id": "string"
}
```

### GET /api/providers/health
Get provider health status.

### GET /api/routing/reports
Get routing performance reports.

## Common Error Codes

All endpoints may return the following error codes:

- `400` - Bad Request (invalid input data)
- `401` - Unauthorized (invalid/missing authentication)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (resource already exists or state conflict)
- `422` - Unprocessable Entity (validation errors)
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error
- `503` - Service Unavailable

## Response Format

All successful responses follow this format:
```json
{
  "success": true,
  "data": "object|array",
  "message": "string?" // Optional success message
}
```

All error responses follow this format:
```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string",
    "details": "object?" // Optional detailed error information
  }
}
```

## Authentication & Authorization

- All endpoints except `/api/auth/login` and `/api/auth/refresh` require authentication
- JWT tokens must be included in `Authorization: Bearer <token>` header
- Role-based access control applies to most endpoints
- Scope-based filtering ensures users only see data they have access to

## Pagination

List endpoints support pagination with these query parameters:
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Items per page (max: 100)

Pagination metadata is included in response:
```json
{
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "pages": "number"
  }
}
```

## Rate Limiting

- Authentication endpoints: 10 requests per minute per IP
- List endpoints: 100 requests per minute per user
- Create/Update/Delete endpoints: 50 requests per minute per user
- Analytics endpoints: 20 requests per minute per user

Rate limit headers are included in responses:
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Time when limit resets (Unix timestamp)