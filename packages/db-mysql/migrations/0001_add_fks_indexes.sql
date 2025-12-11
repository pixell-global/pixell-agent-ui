-- Foreign keys and helpful indexes

ALTER TABLE teams
  ADD INDEX idx_teams_org (org_id);

ALTER TABLE team_members
  ADD INDEX idx_team_members_team (team_id),
  ADD INDEX idx_team_members_user (user_id),
  ADD CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_team_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE brands
  ADD INDEX idx_brands_org (org_id),
  ADD CONSTRAINT fk_brands_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Relax global brand code uniqueness; enforce per-organization uniqueness for name and code
-- Ensure per-org uniqueness for brand names
CREATE UNIQUE INDEX IF NOT EXISTS brands_org_name_unique ON brands (org_id, name);

ALTER TABLE team_brand_access
  ADD INDEX idx_team_brand_access_team (team_id),
  ADD INDEX idx_team_brand_access_brand (brand_id),
  ADD CONSTRAINT fk_tba_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_tba_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

ALTER TABLE user_brand_access
  ADD INDEX idx_uba_brand (brand_id),
  ADD INDEX idx_uba_user (user_id),
  ADD CONSTRAINT fk_uba_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_uba_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE org_invitations
  ADD INDEX idx_inv_org (org_id),
  ADD CONSTRAINT fk_inv_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Stripe/customer fields on organizations (safe add if not exists semantics may vary by MySQL)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id varchar(120) NULL,
  ADD COLUMN IF NOT EXISTS subscription_status ENUM('active','trialing','past_due','incomplete','canceled') NOT NULL DEFAULT 'incomplete';


