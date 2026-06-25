-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'pending_verification', 'locked', 'disabled', 'deleted');

-- CreateEnum
CREATE TYPE "dashboard_period_default" AS ENUM ('current_month', 'last_30_days', 'current_year');

-- CreateEnum
CREATE TYPE "auth_session_status" AS ENUM ('active', 'revoked', 'expired', 'rotated');

-- CreateEnum
CREATE TYPE "account_type" AS ENUM ('checking', 'digital', 'wallet', 'investment', 'card');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "category_type" AS ENUM ('income', 'expense', 'both');

-- CreateEnum
CREATE TYPE "category_status" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('income', 'expense', 'transfer_in', 'transfer_out', 'adjustment');

-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('pending', 'confirmed', 'ignored', 'deleted');

-- CreateEnum
CREATE TYPE "transaction_source" AS ENUM ('manual', 'csv', 'ofx', 'recurring', 'system');

-- CreateEnum
CREATE TYPE "transfer_status" AS ENUM ('confirmed', 'deleted');

-- CreateEnum
CREATE TYPE "monthly_budget_status" AS ENUM ('draft', 'active', 'closed', 'deleted');

-- CreateEnum
CREATE TYPE "goal_type" AS ENUM ('generic', 'emergency_fund', 'travel', 'vehicle', 'property', 'retirement', 'purchase');

-- CreateEnum
CREATE TYPE "goal_priority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "goal_status" AS ENUM ('active', 'paused', 'completed', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "goal_contribution_type" AS ENUM ('contribution', 'withdrawal', 'adjustment');

-- CreateEnum
CREATE TYPE "emergency_fund_calculation_mode" AS ENUM ('manual', 'auto_from_categories');

-- CreateEnum
CREATE TYPE "recurrence_kind" AS ENUM ('weekly', 'monthly', 'yearly');

-- CreateEnum
CREATE TYPE "recurring_transaction_type" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "recurring_transaction_status" AS ENUM ('active', 'paused', 'ended', 'deleted');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('budget_80', 'budget_100', 'goal_reached', 'recurring_due', 'score_changed', 'insight_available', 'security');

-- CreateEnum
CREATE TYPE "notification_severity" AS ENUM ('info', 'warning', 'critical', 'success');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('in_app', 'email', 'push');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('pending', 'sent', 'read', 'dismissed', 'failed');

-- CreateEnum
CREATE TYPE "financial_score_classification" AS ENUM ('critical', 'attention', 'good', 'excellent');

-- CreateEnum
CREATE TYPE "financial_score_component_type" AS ENUM ('savings_rate', 'budget_adherence', 'emergency_fund', 'goal_progress', 'net_worth_evolution');

-- CreateEnum
CREATE TYPE "financial_insight_type" AS ENUM ('spending_increase', 'budget_risk', 'subscription_saving', 'goal_projection', 'cashflow_summary', 'score_recommendation');

-- CreateEnum
CREATE TYPE "financial_insight_source" AS ENUM ('rule_engine', 'ai_service', 'hybrid');

-- CreateEnum
CREATE TYPE "financial_insight_severity" AS ENUM ('info', 'opportunity', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "financial_insight_status" AS ENUM ('new', 'seen', 'dismissed', 'archived');

-- CreateEnum
CREATE TYPE "insight_generation_trigger" AS ENUM ('manual', 'scheduled', 'transaction_created', 'month_closed', 'score_updated');

-- CreateEnum
CREATE TYPE "run_status" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "import_source_type" AS ENUM ('csv', 'ofx');

-- CreateEnum
CREATE TYPE "import_batch_status" AS ENUM ('uploaded', 'parsed', 'review_required', 'imported', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "import_item_inferred_type" AS ENUM ('income', 'expense', 'unknown');

-- CreateEnum
CREATE TYPE "import_item_status" AS ENUM ('pending_review', 'ready', 'imported', 'duplicate', 'ignored', 'failed');

-- CreateEnum
CREATE TYPE "audit_event_type" AS ENUM ('login_success', 'login_failed', 'logout', 'password_reset_requested', 'password_changed', 'entity_created', 'entity_updated', 'entity_deleted', 'import_completed', 'score_calculated', 'insight_generated', 'security_event');

-- CreateEnum
CREATE TYPE "risk_level" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "category_summary_type" AS ENUM ('income', 'expense');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "email_normalized" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'pending_verification',
    "email_verified_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    "month_start_day" INTEGER NOT NULL DEFAULT 1,
    "dashboard_period_default" "dashboard_period_default" NOT NULL DEFAULT 'current_month',
    "ai_insights_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "device_id" VARCHAR(120),
    "user_agent" VARCHAR(512),
    "ip_address" VARCHAR(45),
    "status" "auth_session_status" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "requested_ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "account_type" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "initial_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "include_in_dashboard" BOOLEAN NOT NULL DEFAULT true,
    "color" VARCHAR(20),
    "icon" VARCHAR(60),
    "status" "account_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "name" VARCHAR(80) NOT NULL,
    "type" "category_type" NOT NULL,
    "parent_id" UUID,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_essential" BOOLEAN NOT NULL DEFAULT false,
    "color" VARCHAR(20),
    "icon" VARCHAR(60),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "category_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "category_id" UUID,
    "type" "transaction_type" NOT NULL,
    "status" "transaction_status" NOT NULL DEFAULT 'confirmed',
    "description" VARCHAR(180) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "transaction_date" DATE NOT NULL,
    "posted_at" TIMESTAMPTZ(6),
    "source" "transaction_source" NOT NULL DEFAULT 'manual',
    "merchant_name" VARCHAR(160),
    "notes" TEXT,
    "import_item_id" UUID,
    "recurring_transaction_id" UUID,
    "transfer_id" UUID,
    "external_reference" VARCHAR(180),
    "fingerprint" VARCHAR(128),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "from_account_id" UUID NOT NULL,
    "to_account_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "transfer_date" DATE NOT NULL,
    "description" VARCHAR(180),
    "status" "transfer_status" NOT NULL DEFAULT 'confirmed',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_budgets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "total_limit" DECIMAL(19,4),
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "monthly_budget_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "monthly_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_category_limits" (
    "id" UUID NOT NULL,
    "budget_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "limit_amount" DECIMAL(19,4) NOT NULL,
    "alert_80_sent_at" TIMESTAMPTZ(6),
    "alert_100_sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "budget_category_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "goal_type" NOT NULL DEFAULT 'generic',
    "target_amount" DECIMAL(19,4) NOT NULL,
    "current_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "target_date" DATE,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "priority" "goal_priority" NOT NULL DEFAULT 'medium',
    "status" "goal_status" NOT NULL DEFAULT 'active',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_contributions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "transaction_id" UUID,
    "type" "goal_contribution_type" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "contribution_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "goal_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_fund_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "desired_months" INTEGER NOT NULL,
    "essential_monthly_expense" DECIMAL(19,4),
    "calculation_mode" "emergency_fund_calculation_mode" NOT NULL DEFAULT 'manual',
    "last_calculated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "emergency_fund_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "category_id" UUID,
    "type" "recurring_transaction_type" NOT NULL,
    "recurrence_kind" "recurrence_kind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(180),
    "amount" DECIMAL(19,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "next_occurrence_date" DATE NOT NULL,
    "last_generated_at" TIMESTAMPTZ(6),
    "is_subscription" BOOLEAN NOT NULL DEFAULT false,
    "provider_name" VARCHAR(120),
    "status" "recurring_transaction_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "severity" "notification_severity" NOT NULL DEFAULT 'info',
    "title" VARCHAR(140) NOT NULL,
    "message" TEXT NOT NULL,
    "related_entity_type" VARCHAR(80),
    "related_entity_id" UUID,
    "channel" "notification_channel" NOT NULL DEFAULT 'in_app',
    "status" "notification_status" NOT NULL DEFAULT 'pending',
    "scheduled_for" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_scores" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "classification" "financial_score_classification" NOT NULL,
    "savings_rate" DECIMAL(9,4),
    "expense_ratio" DECIMAL(9,4),
    "emergency_fund_months" DECIMAL(9,4),
    "budget_adherence_rate" DECIMAL(9,4),
    "goal_progress_rate" DECIMAL(9,4),
    "net_worth_delta" DECIMAL(19,4),
    "recommendations" JSONB,
    "calculation_version" VARCHAR(40) NOT NULL,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_score_components" (
    "id" UUID NOT NULL,
    "financial_score_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "component" "financial_score_component_type" NOT NULL,
    "raw_value" DECIMAL(19,4),
    "normalized_score" INTEGER NOT NULL,
    "weight" DECIMAL(9,4) NOT NULL,
    "explanation" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_score_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_insights" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "financial_insight_type" NOT NULL,
    "source" "financial_insight_source" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "severity" "financial_insight_severity" NOT NULL DEFAULT 'info',
    "confidence" DECIMAL(5,4),
    "data_points" JSONB,
    "action_label" VARCHAR(80),
    "status" "financial_insight_status" NOT NULL DEFAULT 'new',
    "generated_by_run_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insight_generation_runs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "trigger" "insight_generation_trigger" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "run_status" NOT NULL DEFAULT 'queued',
    "input_summary" JSONB,
    "model_provider" VARCHAR(80),
    "model_name" VARCHAR(120),
    "prompt_version" VARCHAR(40),
    "token_input_count" INTEGER,
    "token_output_count" INTEGER,
    "error_code" VARCHAR(80),
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insight_generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "source_type" "import_source_type" NOT NULL,
    "original_file_name" VARCHAR(255) NOT NULL,
    "file_hash" VARCHAR(128) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "status" "import_batch_status" NOT NULL DEFAULT 'uploaded',
    "total_rows" INTEGER,
    "parsed_rows" INTEGER,
    "imported_rows" INTEGER,
    "duplicate_rows" INTEGER,
    "failed_rows" INTEGER,
    "parser_version" VARCHAR(40),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_items" (
    "id" UUID NOT NULL,
    "import_batch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "row_number" INTEGER,
    "external_id" VARCHAR(180),
    "raw_description" VARCHAR(255) NOT NULL,
    "normalized_description" VARCHAR(255),
    "amount" DECIMAL(19,4) NOT NULL,
    "inferred_type" "import_item_inferred_type" NOT NULL,
    "transaction_date" DATE NOT NULL,
    "posted_at" TIMESTAMPTZ(6),
    "suggested_category_id" UUID,
    "matched_transaction_id" UUID,
    "status" "import_item_status" NOT NULL DEFAULT 'pending_review',
    "fingerprint" VARCHAR(128) NOT NULL,
    "raw_payload" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "actor_user_id" UUID,
    "event_type" "audit_event_type" NOT NULL,
    "entity_type" VARCHAR(80),
    "entity_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "risk_level" "risk_level" NOT NULL DEFAULT 'low',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balance_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "balance" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_financial_summaries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "total_income" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_expense" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "net_cashflow" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "savings_rate" DECIMAL(9,4),
    "total_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "transaction_count" INTEGER NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monthly_financial_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_category_summaries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "type" "category_summary_type" NOT NULL,
    "total_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "transaction_count" INTEGER NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monthly_category_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_status_idx" ON "auth_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "auth_sessions_refresh_token_hash_idx" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_created_at_idx" ON "password_reset_tokens"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "accounts_user_id_status_idx" ON "accounts"("user_id", "status");

-- CreateIndex
CREATE INDEX "accounts_user_id_type_idx" ON "accounts"("user_id", "type");

-- CreateIndex
CREATE INDEX "accounts_deleted_at_idx" ON "accounts"("deleted_at");

-- CreateIndex
CREATE INDEX "categories_user_id_status_idx" ON "categories"("user_id", "status");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "categories_is_default_idx" ON "categories"("is_default");

-- CreateIndex
CREATE INDEX "categories_deleted_at_idx" ON "categories"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_user_id_type_name_key" ON "categories"("user_id", "type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_import_item_id_key" ON "transactions"("import_item_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_transaction_date_idx" ON "transactions"("user_id", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_user_id_type_transaction_date_idx" ON "transactions"("user_id", "type", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_user_id_account_id_transaction_date_idx" ON "transactions"("user_id", "account_id", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_user_id_category_id_transaction_date_idx" ON "transactions"("user_id", "category_id", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_user_id_status_transaction_date_idx" ON "transactions"("user_id", "status", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_fingerprint_idx" ON "transactions"("fingerprint");

-- CreateIndex
CREATE INDEX "transactions_transfer_id_idx" ON "transactions"("transfer_id");

-- CreateIndex
CREATE INDEX "transactions_recurring_transaction_id_idx" ON "transactions"("recurring_transaction_id");

-- CreateIndex
CREATE INDEX "transactions_deleted_at_idx" ON "transactions"("deleted_at");

-- CreateIndex
CREATE INDEX "transfers_user_id_transfer_date_idx" ON "transfers"("user_id", "transfer_date");

-- CreateIndex
CREATE INDEX "transfers_from_account_id_idx" ON "transfers"("from_account_id");

-- CreateIndex
CREATE INDEX "transfers_to_account_id_idx" ON "transfers"("to_account_id");

-- CreateIndex
CREATE INDEX "transfers_deleted_at_idx" ON "transfers"("deleted_at");

-- CreateIndex
CREATE INDEX "monthly_budgets_user_id_month_status_idx" ON "monthly_budgets"("user_id", "month", "status");

-- CreateIndex
CREATE INDEX "monthly_budgets_deleted_at_idx" ON "monthly_budgets"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_budgets_user_id_month_key" ON "monthly_budgets"("user_id", "month");

-- CreateIndex
CREATE INDEX "budget_category_limits_user_id_category_id_idx" ON "budget_category_limits"("user_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_category_limits_budget_id_category_id_key" ON "budget_category_limits"("budget_id", "category_id");

-- CreateIndex
CREATE INDEX "goals_user_id_status_idx" ON "goals"("user_id", "status");

-- CreateIndex
CREATE INDEX "goals_user_id_type_idx" ON "goals"("user_id", "type");

-- CreateIndex
CREATE INDEX "goals_deleted_at_idx" ON "goals"("deleted_at");

-- CreateIndex
CREATE INDEX "goal_contributions_user_id_goal_id_contribution_date_idx" ON "goal_contributions"("user_id", "goal_id", "contribution_date");

-- CreateIndex
CREATE INDEX "goal_contributions_transaction_id_idx" ON "goal_contributions"("transaction_id");

-- CreateIndex
CREATE INDEX "goal_contributions_deleted_at_idx" ON "goal_contributions"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_fund_plans_goal_id_key" ON "emergency_fund_plans"("goal_id");

-- CreateIndex
CREATE INDEX "emergency_fund_plans_user_id_idx" ON "emergency_fund_plans"("user_id");

-- CreateIndex
CREATE INDEX "recurring_transactions_user_id_status_idx" ON "recurring_transactions"("user_id", "status");

-- CreateIndex
CREATE INDEX "recurring_transactions_user_id_next_occurrence_date_idx" ON "recurring_transactions"("user_id", "next_occurrence_date");

-- CreateIndex
CREATE INDEX "recurring_transactions_account_id_idx" ON "recurring_transactions"("account_id");

-- CreateIndex
CREATE INDEX "recurring_transactions_category_id_idx" ON "recurring_transactions"("category_id");

-- CreateIndex
CREATE INDEX "recurring_transactions_deleted_at_idx" ON "recurring_transactions"("deleted_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_created_at_idx" ON "notifications"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_type_idx" ON "notifications"("user_id", "type");

-- CreateIndex
CREATE INDEX "notifications_scheduled_for_idx" ON "notifications"("scheduled_for");

-- CreateIndex
CREATE INDEX "financial_scores_user_id_calculated_at_idx" ON "financial_scores"("user_id", "calculated_at");

-- CreateIndex
CREATE INDEX "financial_scores_user_id_period_start_period_end_idx" ON "financial_scores"("user_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "financial_scores_user_id_period_start_period_end_calculatio_key" ON "financial_scores"("user_id", "period_start", "period_end", "calculation_version");

-- CreateIndex
CREATE INDEX "financial_score_components_user_id_idx" ON "financial_score_components"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_score_components_financial_score_id_component_key" ON "financial_score_components"("financial_score_id", "component");

-- CreateIndex
CREATE INDEX "financial_insights_user_id_status_created_at_idx" ON "financial_insights"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "financial_insights_user_id_type_period_start_period_end_idx" ON "financial_insights"("user_id", "type", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "financial_insights_generated_by_run_id_idx" ON "financial_insights"("generated_by_run_id");

-- CreateIndex
CREATE INDEX "insight_generation_runs_user_id_status_created_at_idx" ON "insight_generation_runs"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "insight_generation_runs_user_id_period_start_period_end_idx" ON "insight_generation_runs"("user_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "import_batches_user_id_created_at_idx" ON "import_batches"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "import_batches_file_hash_idx" ON "import_batches"("file_hash");

-- CreateIndex
CREATE INDEX "import_batches_status_idx" ON "import_batches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_user_id_account_id_file_hash_key" ON "import_batches"("user_id", "account_id", "file_hash");

-- CreateIndex
CREATE INDEX "import_items_import_batch_id_status_idx" ON "import_items"("import_batch_id", "status");

-- CreateIndex
CREATE INDEX "import_items_user_id_fingerprint_idx" ON "import_items"("user_id", "fingerprint");

-- CreateIndex
CREATE INDEX "import_items_matched_transaction_id_idx" ON "import_items"("matched_transaction_id");

-- CreateIndex
CREATE INDEX "import_items_suggested_category_id_idx" ON "import_items"("suggested_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "import_items_import_batch_id_fingerprint_key" ON "import_items"("import_batch_id", "fingerprint");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_event_type_created_at_idx" ON "audit_logs"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "account_balance_snapshots_user_id_snapshot_date_idx" ON "account_balance_snapshots"("user_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "account_balance_snapshots_user_id_account_id_snapshot_date_idx" ON "account_balance_snapshots"("user_id", "account_id", "snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "account_balance_snapshots_account_id_snapshot_date_key" ON "account_balance_snapshots"("account_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "monthly_financial_summaries_user_id_month_idx" ON "monthly_financial_summaries"("user_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_financial_summaries_user_id_month_key" ON "monthly_financial_summaries"("user_id", "month");

-- CreateIndex
CREATE INDEX "monthly_category_summaries_user_id_month_idx" ON "monthly_category_summaries"("user_id", "month");

-- CreateIndex
CREATE INDEX "monthly_category_summaries_user_id_category_id_month_idx" ON "monthly_category_summaries"("user_id", "category_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_category_summaries_user_id_category_id_month_type_key" ON "monthly_category_summaries"("user_id", "category_id", "month", "type");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_item_id_fkey" FOREIGN KEY ("import_item_id") REFERENCES "import_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_transaction_id_fkey" FOREIGN KEY ("recurring_transaction_id") REFERENCES "recurring_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_budgets" ADD CONSTRAINT "monthly_budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_category_limits" ADD CONSTRAINT "budget_category_limits_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "monthly_budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_category_limits" ADD CONSTRAINT "budget_category_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_category_limits" ADD CONSTRAINT "budget_category_limits_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_fund_plans" ADD CONSTRAINT "emergency_fund_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_fund_plans" ADD CONSTRAINT "emergency_fund_plans_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_scores" ADD CONSTRAINT "financial_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_score_components" ADD CONSTRAINT "financial_score_components_financial_score_id_fkey" FOREIGN KEY ("financial_score_id") REFERENCES "financial_scores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_score_components" ADD CONSTRAINT "financial_score_components_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_insights" ADD CONSTRAINT "financial_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_insights" ADD CONSTRAINT "financial_insights_generated_by_run_id_fkey" FOREIGN KEY ("generated_by_run_id") REFERENCES "insight_generation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insight_generation_runs" ADD CONSTRAINT "insight_generation_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_suggested_category_id_fkey" FOREIGN KEY ("suggested_category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_matched_transaction_id_fkey" FOREIGN KEY ("matched_transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "account_balance_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "account_balance_snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_financial_summaries" ADD CONSTRAINT "monthly_financial_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_category_summaries" ADD CONSTRAINT "monthly_category_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_category_summaries" ADD CONSTRAINT "monthly_category_summaries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
