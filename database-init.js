const { Pool } = require('pg');
require('dotenv').config();

class DatabaseInitializer {
    constructor() {
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }

    async initializeDatabase() {
        try {
            console.log('🔧 Initializing SCA Appliance Liquidations database...');

            // DROP existing table to recreate with full schema
            await this.db.query(`DROP TABLE IF EXISTS organizations CASCADE;`);

           // Create organizations table
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS organizations (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    business_type VARCHAR(100) DEFAULT 'appliance_liquidation',
                    phone_number VARCHAR(20),
                    email VARCHAR(255),
                    address TEXT,
                    city VARCHAR(100),
                    state VARCHAR(50),
                    zip_code VARCHAR(20),
                    country VARCHAR(50) DEFAULT 'US',
                    timezone VARCHAR(50) DEFAULT 'America/Indiana/Evansville',
                    business_hours JSONB DEFAULT '{"delivery_days":["wednesday","saturday"],"appointments":"by_appointment_with_30min_notice","location_note":"across from the solar panel field"}',
                    ai_personality TEXT DEFAULT 'Professional appliance liquidation specialist who helps customers get brand new appliances with full manufacturer warranties at 50% below retail prices',
                    greeting_message TEXT DEFAULT 'Thank you for calling SCA Appliance Liquidations how may i help you today? ',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT true,
                    subscription_plan VARCHAR(50) DEFAULT 'premium'
                );
            `);

            // Create phone numbers table
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS phone_numbers (
                    id SERIAL PRIMARY KEY,
                    uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    phone_number VARCHAR(20) UNIQUE NOT NULL,
                    provider VARCHAR(50) DEFAULT 'telnyx',
                    provider_id VARCHAR(100),
                    is_primary BOOLEAN DEFAULT false,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Create conversations table
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS conversations (
                    id SERIAL PRIMARY KEY,
                    uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    phone_number_id INTEGER REFERENCES phone_numbers(id),
                    caller_number VARCHAR(20) NOT NULL,
                    call_id VARCHAR(100),
                    session_id VARCHAR(100),
                    status VARCHAR(50) DEFAULT 'active',
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ended_at TIMESTAMP,
                    duration_seconds INTEGER DEFAULT 0,
                    call_cost DECIMAL(10,4) DEFAULT 0.0000,
                    sentiment VARCHAR(20) DEFAULT 'neutral',
                    summary TEXT,
                    outcome VARCHAR(100),
                    transferred_to_human BOOLEAN DEFAULT false,
                    satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5)
                );
            `);

            // Create messages table
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS messages (
                    id SERIAL PRIMARY KEY,
                    uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
                    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
                    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
                    content TEXT NOT NULL,
                    audio_url TEXT,
                    confidence_score DECIMAL(3,2),
                    processing_time_ms INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata JSONB
                );
            `);

            // Create appointments table
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS appointments (
                    id SERIAL PRIMARY KEY,
                    uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    conversation_id INTEGER REFERENCES conversations(id),
                    customer_name VARCHAR(255),
                    customer_phone VARCHAR(20),
                    customer_email VARCHAR(255),
                    appointment_date DATE NOT NULL,
                    appointment_time TIME NOT NULL,
                    service_type VARCHAR(100),
                    description TEXT,
                    address TEXT,
                    estimated_duration_minutes INTEGER DEFAULT 60,
                    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    reminder_sent BOOLEAN DEFAULT false,
                    notes TEXT
                );
            `);

            // Create knowledge base table
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS knowledge_base (
                    id SERIAL PRIMARY KEY,
                    uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    category VARCHAR(100) NOT NULL,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    keywords TEXT[],
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    usage_count INTEGER DEFAULT 0
                );
            `);

            console.log('✅ Database tables created successfully!');

            console.log('✅ Database tables created successfully!');
            
            // DEBUG: Check what columns actually exist
            const tableInfo = await this.db.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'organizations' 
                ORDER BY ordinal_position;
            `);
            console.log('🔍 Actual organizations table columns:', tableInfo.rows);

            // Insert SCA Appliance Liquidations as organization #1 (simplified)
            const orgResult = await this.db.query(`
                INSERT INTO organizations (
                    name, business_type, email, address, city, state, zip_code, 
                    country, timezone, ai_personality, greeting_message, subscription_plan
                ) VALUES (
                    'SCA Appliance Liquidations',
                    'appliance_liquidation',
                    'info@sca-appliances.com',
                    '1724 E Morgan Avenue (Corner of Morgan and Marie Avenue)',
                    'Evansville',
                    'IN',
                    '47708',
                    'US',
                    'America/Indiana/Evansville',
                    'Professional appliance liquidation specialist who helps customers get brand new appliances with full manufacturer warranties at 50% below retail prices',
                    'Hello! Thank you for calling SCA Appliance Liquidations. How can I help you find a brand new appliance with full warranty at 50% below retail price today?',
                    'premium'
                )
                ON CONFLICT DO NOTHING
                RETURNING id;
            `);

            console.log('✅ SCA Appliance Liquidations organization created!');

            // Add SCA's phone number
            await this.db.query(`
                INSERT INTO phone_numbers (
                    organization_id, phone_number, provider, is_primary, is_active
                ) VALUES (
                    1, '+15027685233', 'telnyx', true, true
                )
                ON CONFLICT (phone_number) DO NOTHING;
            `);

            // Add SCA's knowledge base
            const knowledgeData = [
                ['products', 'What appliances do you sell?', 'We sell brand new, unused appliances including washers, dryers, stoves, refrigerators, and more. All appliances come with full manufacturer warranties and are at least 50% below normal retail prices.', ['appliances', 'new', 'unused', 'washer', 'dryer', 'stove', 'refrigerator', 'warranty']],
                ['pricing', 'What are your prices like?', 'All our appliances are at least 50% below normal retail prices. Everything is brand new with full manufacturer warranty - you get the same quality for half the price or more!', ['50%', 'below', 'retail', 'discount', 'savings', 'price']],
                ['financing', 'Do you offer financing?', 'Yes! We offer no credit check financing through Snap and ACIMA. Only $50 down to start, and we always have 100 days same as cash available.', ['financing', 'no credit check', 'snap', 'acima', '$50 down', '100 days', 'same as cash']],
                ['delivery', 'Do you deliver?', 'We deliver locally on Wednesdays and Saturdays only. Delivery pricing depends on distance and difficulty of the delivery location.', ['delivery', 'wednesday', 'saturday', 'local', 'distance']],
                ['appointments', 'How do I schedule an appointment?', 'We work by scheduled appointments and will gladly meet anyone anytime with a scheduled appointment and just 30 minutes notice.', ['appointment', 'schedule', '30 minutes', 'notice', 'meet']],
                ['location', 'Where are you located?', 'We are located at 1724 E Morgan Avenue, at the corner of Morgan and Marie Avenue, across from the solar panel field in Evansville, IN.', ['location', '1724 e morgan', 'morgan avenue', 'marie avenue', 'solar panel field', 'evansville']],
                ['warranty', 'What warranty do you offer?', 'All our appliances come with the full manufacturer warranty since they are brand new and unused. You get the same warranty protection as buying retail.', ['warranty', 'manufacturer', 'brand new', 'unused', 'protection']]
            ];

            for (const [category, question, answer, keywords] of knowledgeData) {
                await this.db.query(`
                    INSERT INTO knowledge_base (organization_id, category, question, answer, keywords)
                    VALUES (1, $1, $2, $3, $4)
                    ON CONFLICT DO NOTHING;
                `, [category, question, answer, keywords]);
            }

            console.log('✅ SCA knowledge base populated!');
            console.log('🎉 DATABASE INITIALIZATION COMPLETE! SCA Appliance Liquidations is ready!');

            return true;
        } catch (error) {
            console.error('❌ Database initialization error:', error);
            throw error;
        }
    }

    async close() {
        await this.db.end();
    }
}

module.exports = { DatabaseInitializer };