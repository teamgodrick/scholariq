# DBMS Fundamentals

Normalization organises tables to reduce redundancy and update anomalies. First Normal Form (1NF) requires atomic values and no repeating groups. Second Normal Form (2NF) is 1NF with no partial dependency of a non-key attribute on part of a composite key. Third Normal Form (3NF) is 2NF with no transitive dependency of a non-key attribute on another non-key attribute. BCNF is stricter: every determinant must be a candidate key.

A primary key uniquely identifies each row and cannot be NULL. A candidate key is any minimal set of columns that could be the primary key. A foreign key is a column that references the primary key of another table and enforces referential integrity. A super key is any set of columns that uniquely identifies a row.

ACID properties of transactions: Atomicity (all or nothing), Consistency (the database moves from one valid state to another), Isolation (concurrent transactions do not interfere), Durability (committed data survives failures). Isolation levels from weakest to strongest are Read Uncommitted, Read Committed, Repeatable Read and Serializable; stronger levels prevent dirty reads, non-repeatable reads and phantom reads.

SQL joins: INNER JOIN returns matching rows from both tables. LEFT JOIN returns all rows from the left table and matches from the right, with NULL where there is no match. RIGHT JOIN is the mirror image. FULL OUTER JOIN returns all rows from both tables. CROSS JOIN returns the Cartesian product. GROUP BY groups rows for aggregates such as COUNT, SUM and AVG; HAVING filters groups, while WHERE filters rows before grouping.

An index is a data structure, usually a B-tree, that speeds up lookups on a column at the cost of extra storage and slower writes. A view is a stored query that behaves like a virtual table. A trigger runs automatically on INSERT, UPDATE or DELETE. DDL commands define structure (CREATE, ALTER, DROP); DML commands change data (INSERT, UPDATE, DELETE); DCL commands control access (GRANT, REVOKE).
