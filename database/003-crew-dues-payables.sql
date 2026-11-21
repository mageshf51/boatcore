-- Additive upgrade for SQL Server 2019 Express. Run after 001, in the BoatCore database.
SET XACT_ABORT ON;
IF OBJECT_ID('dbo.CrewAdvances') IS NULL
 CREATE TABLE dbo.CrewAdvances(Id uniqueidentifier NOT NULL PRIMARY KEY,CrewId uniqueidentifier NOT NULL REFERENCES dbo.Records(Id),AdvanceDate date NOT NULL,Amount decimal(18,2) NOT NULL CHECK(Amount>0),Notes nvarchar(2000) NOT NULL,Actor nvarchar(200) NOT NULL);
IF OBJECT_ID('dbo.WageBatches') IS NULL
 CREATE TABLE dbo.WageBatches(Id uniqueidentifier NOT NULL PRIMARY KEY,WorkDate date NOT NULL,Amount decimal(18,2) NOT NULL CHECK(Amount>0),Notes nvarchar(2000) NOT NULL,Version int NOT NULL);
IF OBJECT_ID('dbo.WageEntries') IS NULL
 CREATE TABLE dbo.WageEntries(BatchId uniqueidentifier NOT NULL REFERENCES dbo.WageBatches(Id),CrewId uniqueidentifier NOT NULL REFERENCES dbo.Records(Id),Amount decimal(18,2) NOT NULL CHECK(Amount>0),PRIMARY KEY(BatchId,CrewId));
IF OBJECT_ID('dbo.CrewSalaryAccounts') IS NULL
 CREATE TABLE dbo.CrewSalaryAccounts(SourceType varchar(4) NOT NULL CHECK(SourceType IN('trip','wage')),SourceId uniqueidentifier NOT NULL,CrewId uniqueidentifier NOT NULL REFERENCES dbo.Records(Id),CrewName nvarchar(200) NOT NULL,SourceLabel nvarchar(2000) NOT NULL,SalaryDate date NOT NULL,Salary decimal(18,2) NOT NULL CHECK(Salary>=0),AdvanceBefore decimal(18,2) NOT NULL CHECK(AdvanceBefore>=0),AppliedAdvance decimal(18,2) NOT NULL CHECK(AppliedAdvance>=0),CashBalance decimal(18,2) NOT NULL CHECK(CashBalance>=0),ExcessAdvance decimal(18,2) NOT NULL CHECK(ExcessAdvance>=0),IsReady bit NOT NULL,IsPaid bit NOT NULL,PRIMARY KEY(SourceType,SourceId,CrewId));
IF OBJECT_ID('dbo.CrewSalaryPayments') IS NULL
 CREATE TABLE dbo.CrewSalaryPayments(Id uniqueidentifier NOT NULL PRIMARY KEY,SourceType varchar(4) NOT NULL,SourceId uniqueidentifier NOT NULL,CrewId uniqueidentifier NOT NULL,TripId uniqueidentifier NULL,PaymentDate date NOT NULL,Salary decimal(18,2) NOT NULL,AppliedAdvance decimal(18,2) NOT NULL,CashPaid decimal(18,2) NOT NULL,AdvanceAfter decimal(18,2) NOT NULL,Mode varchar(4) NOT NULL CHECK(Mode IN('net','full')),Actor nvarchar(200) NOT NULL,Notes nvarchar(2000) NOT NULL,CONSTRAINT UQ_CrewSalaryPayment UNIQUE(SourceType,SourceId,CrewId),CONSTRAINT FK_SalaryPayment_Account FOREIGN KEY(SourceType,SourceId,CrewId) REFERENCES dbo.CrewSalaryAccounts(SourceType,SourceId,CrewId),CONSTRAINT CK_SalaryPayment_Amount CHECK(Salary=AppliedAdvance+CashPaid AND Salary>=0 AND AppliedAdvance>=0 AND CashPaid>=0 AND AdvanceAfter>=0));
IF OBJECT_ID('dbo.BuyerReceipts') IS NULL
 CREATE TABLE dbo.BuyerReceipts(Id uniqueidentifier NOT NULL PRIMARY KEY,SaleId uniqueidentifier NOT NULL REFERENCES dbo.Records(Id),ReceiptDate date NOT NULL,Amount decimal(18,2) NOT NULL CHECK(Amount>0),Actor nvarchar(200) NOT NULL,Notes nvarchar(2000) NOT NULL);
IF OBJECT_ID('dbo.ExpensePayments') IS NULL
 CREATE TABLE dbo.ExpensePayments(Id uniqueidentifier NOT NULL PRIMARY KEY,ExpenseId uniqueidentifier NOT NULL REFERENCES dbo.Records(Id),PaymentDate date NOT NULL,Amount decimal(18,2) NOT NULL CHECK(Amount>0),Actor nvarchar(200) NOT NULL,Notes nvarchar(2000) NOT NULL);
GO
CREATE OR ALTER TRIGGER dbo.CrewSalaryPayments_Immutable ON dbo.CrewSalaryPayments INSTEAD OF UPDATE,DELETE AS
BEGIN
 THROW 50003,'Salary payment history is immutable',1;
END;
GO
CREATE OR ALTER PROCEDURE dbo.RefreshCrewPayableTables @payload nvarchar(max),@ledger nvarchar(max) AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF ISJSON(@payload)<>1 OR ISJSON(@ledger)<>1 THROW 50004,'Invalid ledger payload',1;
 INSERT dbo.CrewAdvances(Id,CrewId,AdvanceDate,Amount,Notes,Actor)
 SELECT a.Id,a.CrewId,a.AdvanceDate,a.Amount,a.Notes,a.Actor FROM OPENJSON(@payload,'$.entities.advances') WITH(Id uniqueidentifier '$.id',CrewId uniqueidentifier '$.crewId',AdvanceDate date '$.date',Amount decimal(18,2) '$.amount',Notes nvarchar(2000) '$.notes',Actor nvarchar(200) '$.actor') a WHERE NOT EXISTS(SELECT 1 FROM dbo.CrewAdvances x WHERE x.Id=a.Id);
 MERGE dbo.WageBatches AS t USING(SELECT * FROM OPENJSON(@payload,'$.entities.wages') WITH(Id uniqueidentifier '$.id',WorkDate date '$.date',Amount decimal(18,2) '$.amount',Notes nvarchar(2000) '$.notes',Version int '$.version')) s ON s.Id=t.Id
 WHEN MATCHED THEN UPDATE SET WorkDate=s.WorkDate,Amount=s.Amount,Notes=s.Notes,Version=s.Version
 WHEN NOT MATCHED THEN INSERT(Id,WorkDate,Amount,Notes,Version) VALUES(s.Id,s.WorkDate,s.Amount,s.Notes,s.Version);
 MERGE dbo.WageEntries AS t USING(SELECT CONVERT(uniqueidentifier,JSON_VALUE(w.value,'$.id')) BatchId,m.CrewId,m.Amount FROM OPENJSON(@payload,'$.entities.wages') w CROSS APPLY OPENJSON(w.value,'$.members') WITH(CrewId uniqueidentifier '$.crewId',Amount decimal(18,2) '$.amount') m) s ON s.BatchId=t.BatchId AND s.CrewId=t.CrewId
 WHEN MATCHED THEN UPDATE SET Amount=s.Amount WHEN NOT MATCHED THEN INSERT(BatchId,CrewId,Amount) VALUES(s.BatchId,s.CrewId,s.Amount) WHEN NOT MATCHED BY SOURCE THEN DELETE;
 -- The authoritative decimal calculator sends both pending entitlements and immutable payments.
 -- This projection avoids reimplementing largest-remainder arithmetic in SQL reports.
 SELECT p.SourceType,p.SourceId,p.CrewId,p.CrewName,p.SourceLabel,p.SalaryDate,p.Salary,p.AdvanceBefore,p.AppliedAdvance,p.CashBalance,p.ExcessAdvance,p.IsReady,CONVERT(bit,0) IsPaid INTO #Accounts FROM OPENJSON(@ledger,'$.pending') WITH(SourceType varchar(4) '$.sourceType',SourceId uniqueidentifier '$.sourceId',CrewId uniqueidentifier '$.crewId',CrewName nvarchar(200) '$.name',SourceLabel nvarchar(2000) '$.trip',SalaryDate date '$.date',Salary decimal(18,2) '$.salary',AdvanceBefore decimal(18,2) '$.advance',AppliedAdvance decimal(18,2) '$.appliedAdvance',CashBalance decimal(18,2) '$.balance',ExcessAdvance decimal(18,2) '$.overdue',IsReady bit '$.ready') p
 UNION ALL SELECT p.SourceType,p.SourceId,p.CrewId,p.CrewName,p.SourceLabel,p.SalaryDate,p.Salary,p.AdvanceBefore,p.AppliedAdvance,CONVERT(decimal(18,2),0),p.AdvanceAfter,CONVERT(bit,1),CONVERT(bit,1) FROM OPENJSON(@ledger,'$.payments') WITH(SourceType varchar(4) '$.sourceType',SourceId uniqueidentifier '$.sourceId',CrewId uniqueidentifier '$.crewId',CrewName nvarchar(200) '$.name',SourceLabel nvarchar(2000) '$.sourceLabel',SalaryDate date '$.date',Salary decimal(18,2) '$.salary',AdvanceBefore decimal(18,2) '$.advanceBefore',AppliedAdvance decimal(18,2) '$.appliedAdvance',AdvanceAfter decimal(18,2) '$.advanceAfter') p;
 MERGE dbo.CrewSalaryAccounts AS t USING #Accounts s ON t.SourceType=s.SourceType AND t.SourceId=s.SourceId AND t.CrewId=s.CrewId
 WHEN MATCHED THEN UPDATE SET CrewName=s.CrewName,SourceLabel=s.SourceLabel,SalaryDate=s.SalaryDate,Salary=s.Salary,AdvanceBefore=s.AdvanceBefore,AppliedAdvance=s.AppliedAdvance,CashBalance=s.CashBalance,ExcessAdvance=s.ExcessAdvance,IsReady=s.IsReady,IsPaid=s.IsPaid
 WHEN NOT MATCHED THEN INSERT(SourceType,SourceId,CrewId,CrewName,SourceLabel,SalaryDate,Salary,AdvanceBefore,AppliedAdvance,CashBalance,ExcessAdvance,IsReady,IsPaid) VALUES(s.SourceType,s.SourceId,s.CrewId,s.CrewName,s.SourceLabel,s.SalaryDate,s.Salary,s.AdvanceBefore,s.AppliedAdvance,s.CashBalance,s.ExcessAdvance,s.IsReady,s.IsPaid)
 WHEN NOT MATCHED BY SOURCE THEN DELETE;
 INSERT dbo.CrewSalaryPayments(Id,SourceType,SourceId,CrewId,TripId,PaymentDate,Salary,AppliedAdvance,CashPaid,AdvanceAfter,Mode,Actor,Notes)
 SELECT p.Id,p.SourceType,p.SourceId,p.CrewId,p.TripId,p.PaymentDate,p.Salary,p.AppliedAdvance,p.CashPaid,p.AdvanceAfter,p.Mode,p.Actor,p.Notes FROM OPENJSON(@payload,'$.entities.crewPayments') WITH(Id uniqueidentifier '$.id',SourceType varchar(4) '$.sourceType',SourceId uniqueidentifier '$.sourceId',CrewId uniqueidentifier '$.crewId',TripId uniqueidentifier '$.tripId',PaymentDate date '$.date',Salary decimal(18,2) '$.salary',AppliedAdvance decimal(18,2) '$.appliedAdvance',CashPaid decimal(18,2) '$.amount',AdvanceAfter decimal(18,2) '$.advanceAfter',Mode varchar(4) '$.mode',Actor nvarchar(200) '$.actor',Notes nvarchar(2000) '$.notes') p WHERE NOT EXISTS(SELECT 1 FROM dbo.CrewSalaryPayments x WHERE x.Id=p.Id);
 INSERT dbo.BuyerReceipts(Id,SaleId,ReceiptDate,Amount,Actor,Notes)
 SELECT p.Id,CONVERT(uniqueidentifier,JSON_VALUE(s.value,'$.id')),p.ReceiptDate,p.Amount,p.Actor,COALESCE(p.Notes,N'') FROM OPENJSON(@payload,'$.entities.sales') s CROSS APPLY OPENJSON(s.value,'$.payments') WITH(Id uniqueidentifier '$.id',ReceiptDate date '$.date',Amount decimal(18,2) '$.amount',Actor nvarchar(200) '$.actor',Notes nvarchar(2000) '$.notes') p WHERE JSON_VALUE(s.value,'$.type')='sale' AND NOT EXISTS(SELECT 1 FROM dbo.BuyerReceipts x WHERE x.Id=p.Id);
 INSERT dbo.ExpensePayments(Id,ExpenseId,PaymentDate,Amount,Actor,Notes)
 SELECT p.Id,CONVERT(uniqueidentifier,JSON_VALUE(e.value,'$.id')),p.PaymentDate,p.Amount,p.Actor,COALESCE(p.Notes,N'') FROM OPENJSON(@payload,'$.entities.expenses') e CROSS APPLY OPENJSON(e.value,'$.payments') WITH(Id uniqueidentifier '$.id',PaymentDate date '$.date',Amount decimal(18,2) '$.amount',Actor nvarchar(200) '$.actor',Notes nvarchar(2000) '$.notes') p WHERE NOT EXISTS(SELECT 1 FROM dbo.ExpensePayments x WHERE x.Id=p.Id);
END;
GO
CREATE OR ALTER VIEW dbo.BuyerDues AS
 SELECT r.Id SaleId,r.TripId,JSON_VALUE(r.Payload,'$.buyer') Buyer,JSON_VALUE(r.Payload,'$.phone') Phone,TRY_CONVERT(date,JSON_VALUE(r.Payload,'$.date')) SaleDate,r.Amount,
 CASE WHEN JSON_QUERY(r.Payload,'$.payments') IS NULL THEN r.Amount ELSE COALESCE(p.Received,0) END Received,
 r.Amount-CASE WHEN JSON_QUERY(r.Payload,'$.payments') IS NULL THEN r.Amount ELSE COALESCE(p.Received,0) END Balance
 FROM dbo.Records r OUTER APPLY(SELECT SUM(TRY_CONVERT(decimal(18,2),JSON_VALUE(j.value,'$.amount'))) Received FROM OPENJSON(r.Payload,'$.payments') j) p WHERE r.Kind='sales' AND JSON_VALUE(r.Payload,'$.type')='sale';
GO
CREATE OR ALTER VIEW dbo.SupplierPayables AS
 SELECT r.Id ExpenseId,r.TripId,COALESCE(NULLIF(JSON_VALUE(r.Payload,'$.supplier'),N''),JSON_VALUE(product.Payload,'$.name')) Supplier,JSON_VALUE(product.Payload,'$.name') Product,TRY_CONVERT(date,JSON_VALUE(r.Payload,'$.date')) ExpenseDate,r.Amount,COALESCE(p.Paid,0) Paid,r.Amount-COALESCE(p.Paid,0) Balance
 FROM dbo.Records r LEFT JOIN dbo.Records product ON product.Id=TRY_CONVERT(uniqueidentifier,JSON_VALUE(r.Payload,'$.productId')) OUTER APPLY(SELECT SUM(TRY_CONVERT(decimal(18,2),JSON_VALUE(j.value,'$.amount'))) Paid FROM OPENJSON(r.Payload,'$.payments') j) p WHERE r.Kind='expenses';
GO
CREATE OR ALTER PROCEDURE dbo.GetCrewPendingSalaries @CrewId uniqueidentifier=NULL AS
 SELECT * FROM dbo.CrewSalaryAccounts WHERE IsPaid=0 AND (@CrewId IS NULL OR CrewId=@CrewId) ORDER BY SalaryDate,SourceId,CrewId;
GO
CREATE OR ALTER PROCEDURE dbo.GetCrewStatement @CrewId uniqueidentifier AS
BEGIN
 SELECT * FROM dbo.CrewAdvances WHERE CrewId=@CrewId ORDER BY AdvanceDate,Id;
 SELECT * FROM dbo.CrewSalaryAccounts WHERE CrewId=@CrewId ORDER BY SalaryDate,SourceId;
 SELECT * FROM dbo.CrewSalaryPayments WHERE CrewId=@CrewId ORDER BY PaymentDate,Id;
 SELECT COALESCE((SELECT SUM(Amount) FROM dbo.CrewAdvances WHERE CrewId=@CrewId),0)-COALESCE((SELECT SUM(AppliedAdvance) FROM dbo.CrewSalaryPayments WHERE CrewId=@CrewId),0) OutstandingAdvance;
END;
GO
CREATE OR ALTER PROCEDURE dbo.GetDuesPayables @Tab varchar(10)='buyer',@IncludePaid bit=0 AS
BEGIN
 IF @Tab='buyer' SELECT * FROM dbo.BuyerDues WHERE @IncludePaid=1 OR Balance>0 ORDER BY SaleDate,SaleId;
 ELSE IF @Tab='supplier' SELECT * FROM dbo.SupplierPayables WHERE @IncludePaid=1 OR Balance>0 ORDER BY ExpenseDate,ExpenseId;
 ELSE THROW 50005,'Tab must be buyer or supplier',1;
END;
GO
