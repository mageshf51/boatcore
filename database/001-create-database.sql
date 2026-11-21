-- Run using setup-database.ts (database name is validated by that script).
-- Fresh setup only; no DROP DATABASE and no destructive reset.
IF OBJECT_ID('dbo.AppState') IS NULL
BEGIN
 CREATE TABLE dbo.AppState(Id int NOT NULL PRIMARY KEY CHECK(Id=1),Payload nvarchar(max) NOT NULL CHECK(ISJSON(Payload)=1),Version rowversion);
 INSERT dbo.AppState(Id,Payload) VALUES(1,N'{"users":[],"sessions":[],"attempts":{},"entities":{"crew":[],"products":[],"trips":[],"sales":[],"expenses":[],"settlements":[],"messages":[]},"audit":[],"settings":{"commissionPercent":"2","crewPercent":"21","fieldVisibility":{"admin":["*"],"guest":["*"],"operator":["operations","finance"]}}}');
END;
IF OBJECT_ID('dbo.Records') IS NULL
BEGIN
 CREATE TABLE dbo.Records(Id uniqueidentifier NOT NULL PRIMARY KEY,Kind varchar(20) NOT NULL,TripId uniqueidentifier NULL,Amount decimal(18,2) NULL,Version int NOT NULL,Payload nvarchar(max) NOT NULL CHECK(ISJSON(Payload)=1),UpdatedAt datetimeoffset NOT NULL);
 CREATE INDEX IX_Records_TripKind ON dbo.Records(TripId,Kind);
END;
IF OBJECT_ID('dbo.AuditEvents') IS NULL
 CREATE TABLE dbo.AuditEvents(Id uniqueidentifier PRIMARY KEY,Actor nvarchar(200) NOT NULL,UserId uniqueidentifier NOT NULL,Action varchar(50) NOT NULL,Kind varchar(30) NOT NULL,RecordId nvarchar(100) NOT NULL,TripId uniqueidentifier NULL,At datetimeoffset NOT NULL,BeforeData nvarchar(max) NULL,AfterData nvarchar(max) NULL);
GO
CREATE OR ALTER TRIGGER dbo.AuditEvents_Immutable ON dbo.AuditEvents INSTEAD OF UPDATE,DELETE AS
 THROW 50002,'Audit events cannot be modified or deleted',1;
GO
CREATE OR ALTER PROCEDURE dbo.RefreshReportingTables @payload nvarchar(max) AS
BEGIN
 SET NOCOUNT ON;
 MERGE dbo.Records WITH (HOLDLOCK) AS target
 USING (SELECT CONVERT(uniqueidentifier,JSON_VALUE(r.value,'$.id')) Id,k.[key] Kind,TRY_CONVERT(uniqueidentifier,JSON_VALUE(r.value,'$.tripId')) TripId,TRY_CONVERT(decimal(18,2),JSON_VALUE(r.value,'$.amount')) Amount,CONVERT(int,JSON_VALUE(r.value,'$.version')) Version,r.value Payload,CONVERT(datetimeoffset,JSON_VALUE(r.value,'$.updatedAt')) UpdatedAt FROM OPENJSON(@payload,'$.entities') k CROSS APPLY OPENJSON(k.value) r) AS src
 ON target.Id=src.Id
 WHEN MATCHED AND (target.Version<>src.Version OR target.Payload<>src.Payload) THEN UPDATE SET Payload=src.Payload,Version=src.Version,Amount=src.Amount,UpdatedAt=src.UpdatedAt,TripId=src.TripId
 WHEN NOT MATCHED THEN INSERT(Id,Kind,TripId,Amount,Version,Payload,UpdatedAt) VALUES(src.Id,src.Kind,src.TripId,src.Amount,src.Version,src.Payload,src.UpdatedAt);
 INSERT dbo.AuditEvents SELECT a.Id,a.Actor,a.UserId,a.Action,a.Kind,a.RecordId,a.TripId,a.At,a.BeforeData,a.AfterData
 FROM OPENJSON(@payload,'$.audit') WITH(Id uniqueidentifier '$.id',Actor nvarchar(200) '$.actor',UserId uniqueidentifier '$.userId',Action varchar(50) '$.action',Kind varchar(30) '$.kind',RecordId nvarchar(100) '$.recordId',TripId uniqueidentifier '$.tripId',At datetimeoffset '$.at',BeforeData nvarchar(max) '$.before' AS JSON,AfterData nvarchar(max) '$.after' AS JSON) a
 WHERE NOT EXISTS(SELECT 1 FROM dbo.AuditEvents x WHERE x.Id=a.Id);
END;
GO
CREATE OR ALTER VIEW dbo.Trips AS SELECT Id,JSON_VALUE(Payload,'$.name') Name,TRY_CONVERT(date,JSON_VALUE(Payload,'$.departure')) Departure,TRY_CONVERT(date,JSON_VALUE(Payload,'$.returnDate')) ReturnDate,JSON_VALUE(Payload,'$.completed') Completed,Payload FROM dbo.Records WHERE Kind='trips';
GO
CREATE OR ALTER VIEW dbo.Sales AS SELECT Id,TripId,Amount,JSON_VALUE(Payload,'$.type') Type,TRY_CONVERT(date,JSON_VALUE(Payload,'$.date')) SaleDate,JSON_VALUE(Payload,'$.buyer') Buyer,Payload FROM dbo.Records WHERE Kind='sales';
GO
CREATE OR ALTER VIEW dbo.Expenses AS SELECT Id,TripId,Amount,JSON_VALUE(Payload,'$.productId') ProductId,Payload FROM dbo.Records WHERE Kind='expenses';
GO
CREATE OR ALTER VIEW dbo.Crew AS SELECT Id,JSON_VALUE(Payload,'$.name') Name,TRY_CONVERT(int,JSON_VALUE(Payload,'$.serial')) Serial,Payload FROM dbo.Records WHERE Kind='crew';
GO
CREATE OR ALTER VIEW dbo.Products AS SELECT Id,JSON_VALUE(Payload,'$.name') Name,JSON_VALUE(Payload,'$.unit') Unit,Payload FROM dbo.Records WHERE Kind='products';
GO
CREATE OR ALTER VIEW dbo.Settlements AS SELECT Id,TripId,Payload FROM dbo.Records WHERE Kind='settlements';
GO
CREATE OR ALTER VIEW dbo.TeamMessages AS SELECT Id,JSON_VALUE(Payload,'$.author') Author,JSON_VALUE(Payload,'$.text') Message,UpdatedAt FROM dbo.Records WHERE Kind='messages';
