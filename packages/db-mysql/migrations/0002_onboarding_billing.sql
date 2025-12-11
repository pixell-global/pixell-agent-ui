-- Add Stripe columns for organizations (safe to run once)
ALTER TABLE organizations
  ADD COLUMN stripe_customer_id varchar(120) NULL;

ALTER TABLE organizations
  ADD COLUMN subscription_status ENUM('active','trialing','past_due','incomplete','canceled') NOT NULL DEFAULT 'incomplete';


