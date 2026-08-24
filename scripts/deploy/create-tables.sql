-- TSA Outliers Monitoring - Database Schema for Supabase
-- Generated for odp-map project (bjjhswrpsmvljqsbbycj)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Divisions
CREATE TABLE IF NOT EXISTS "Division" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "divisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Monitoring Rows
CREATE TABLE IF NOT EXISTS "MonitoringRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNum" INTEGER NOT NULL,
    "categoryBak" TEXT NOT NULL DEFAULT '',
    "provinsi" TEXT NOT NULL DEFAULT '',
    "kabupaten" TEXT NOT NULL DEFAULT '',
    "kecamatan" TEXT NOT NULL DEFAULT '',
    "kelurahan" TEXT NOT NULL DEFAULT '',
    "kelRwSiteName" TEXT NOT NULL DEFAULT '',
    "desaPerum" TEXT NOT NULL DEFAULT '',
    "indexNum" INTEGER NOT NULL DEFAULT 0,
    "homepass" INTEGER NOT NULL DEFAULT 0,
    "odp" INTEGER NOT NULL DEFAULT 0,
    "remarksTsa" TEXT NOT NULL DEFAULT '',
    "klasifikasiTsa" TEXT NOT NULL DEFAULT '',
    "picTsa" TEXT NOT NULL DEFAULT '',
    "remarksJlm" TEXT NOT NULL DEFAULT '',
    "customData" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Custom Columns
CREATE TABLE IF NOT EXISTS "CustomColumn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT FALSE,
    "divisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomColumn_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "tableName" TEXT NOT NULL DEFAULT 'MonitoringRow',
    "rowId" TEXT,
    "colKey" TEXT,
    "colLabel" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Chart Configs
CREATE TABLE IF NOT EXISTS "ChartConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Chart',
    "chartType" TEXT NOT NULL DEFAULT 'bar',
    "config" TEXT NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "MonitoringRow_provinsi_idx" ON "MonitoringRow"("provinsi");
CREATE INDEX IF NOT EXISTS "MonitoringRow_kabupaten_idx" ON "MonitoringRow"("kabupaten");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
CREATE INDEX IF NOT EXISTS "User_username_idx" ON "User"("username");
CREATE INDEX IF NOT EXISTS "CustomColumn_divisionId_idx" ON "CustomColumn"("divisionId");

-- Enable RLS (Row Level Security) on all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Division" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MonitoringRow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomColumn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChartConfig" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow service_role full access, anon read for monitoring)
CREATE POLICY "Service role full access on User" ON "User" FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on Division" ON "Division" FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on MonitoringRow" ON "MonitoringRow" FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on CustomColumn" ON "CustomColumn" FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on AuditLog" ON "AuditLog" FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on ChartConfig" ON "ChartConfig" FOR ALL USING (auth.role() = 'service_role');

-- Allow anon to read MonitoringRow and ChartConfig
CREATE POLICY "Anon read MonitoringRow" ON "MonitoringRow" FOR SELECT USING (true);
CREATE POLICY "Anon read ChartConfig" ON "ChartConfig" FOR SELECT USING (true);
CREATE POLICY "Anon read Division" ON "Division" FOR SELECT USING (true);
CREATE POLICY "Anon read CustomColumn" ON "CustomColumn" FOR SELECT USING (true);
