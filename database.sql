-- Core tenant management
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'America/Chicago',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE org_settings (
    org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    business_hours JSONB DEFAULT '{"monday":{"open":"09:00","close":"17:00"},"tuesday":{"open":"09:00","close":"17:00"},"wednesday":{"open":"09:00","close":"17:00"},"thursday":{"open":"09:00","close":"17:00"},"friday":{"open":"09:00","close":"17:00"},"saturday":{"open":"10:00","close":"14:00"},"sunday":{"closed":true}}',
    services_offered JSONB DEFAULT '["general_service"]',
    languages_enabled JSONB DEFAULT '["en","es","zh","vi","ko"]',
    ai_personality TEXT DEFAULT 'professional',
    greeting_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (org_id)
);

CREATE TABLE org_users (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255),
    role VARCHAR(100) DEFAULT 'admin',
    pin_code VARCHAR(10),
    phone_number VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Multi-phone support per tenant
CREATE TABLE org_phone_numbers (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    telnyx_sid VARCHAR(255),
    phone_number VARCHAR(20) UNIQUE,
    type VARCHAR(50) DEFAULT 'primary',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Customer data (per tenant)
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    name VARCHAR(255),
    email VARCHAR(255),
    preferred_language VARCHAR(5) DEFAULT 'en',
    consent_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(org_id, phone)
);

-- Communication logs
CREATE TABLE calls (
    id SERIAL PRIMARY KEY,
    org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    call_sid VARCHAR(255) UNIQUE,
    customer_phone VARCHAR(20),
    duration INTEGER,
    language_used VARCHAR(5),
    transcript TEXT,
    disposition VARCHAR(100),
    transferred_to_human BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Initial tenant (Mike's Appliances)
INSERT INTO organizations (name, business_type) VALUES ('Mikes Appliances', 'appliance_repair');
INSERT INTO org_settings (org_id) VALUES (1);
INSERT INTO org_users (org_id, name, role, pin_code, phone_number) VALUES (1, 'Mike', 'owner', '1234', '+1234567890');