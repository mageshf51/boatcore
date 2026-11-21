-- Run manually in SSMS as administrator after replacing the password.
-- Replace BoatCore here if SQL_DATABASE uses another name.
USE master;
GO
-- Intentionally requires a password you choose before execution.
-- CREATE LOGIN boatcore_app WITH PASSWORD='REPLACE_WITH_A_STRONG_UNIQUE_PASSWORD', CHECK_POLICY=ON;
USE BoatCore;
GO
IF USER_ID('boatcore_app') IS NULL CREATE USER boatcore_app FOR LOGIN boatcore_app;
GRANT SELECT,UPDATE ON dbo.AppState TO boatcore_app;
GRANT EXECUTE ON dbo.RefreshReportingTables TO boatcore_app;
-- Ownership chaining permits projection writes only through the procedure.
GRANT SELECT ON dbo.Trips TO boatcore_app;
GRANT SELECT ON dbo.Sales TO boatcore_app;
GRANT SELECT ON dbo.Expenses TO boatcore_app;
GRANT SELECT ON dbo.Crew TO boatcore_app;
GRANT SELECT ON dbo.Products TO boatcore_app;
GRANT SELECT ON dbo.Settlements TO boatcore_app;
GRANT SELECT ON dbo.TeamMessages TO boatcore_app;
GRANT SELECT ON dbo.AuditEvents TO boatcore_app;

GRANT EXECUTE ON dbo.RefreshCrewPayableTables TO boatcore_app;
GRANT EXECUTE ON dbo.GetCrewPendingSalaries TO boatcore_app;
GRANT EXECUTE ON dbo.GetCrewStatement TO boatcore_app;
GRANT EXECUTE ON dbo.GetDuesPayables TO boatcore_app;
GRANT SELECT ON dbo.CrewAdvances TO boatcore_app;
GRANT SELECT ON dbo.WageBatches TO boatcore_app;
GRANT SELECT ON dbo.WageEntries TO boatcore_app;
GRANT SELECT ON dbo.CrewSalaryAccounts TO boatcore_app;
GRANT SELECT ON dbo.CrewSalaryPayments TO boatcore_app;
GRANT SELECT ON dbo.BuyerReceipts TO boatcore_app;
GRANT SELECT ON dbo.ExpensePayments TO boatcore_app;
GRANT SELECT ON dbo.BuyerDues TO boatcore_app;
GRANT SELECT ON dbo.SupplierPayables TO boatcore_app;
