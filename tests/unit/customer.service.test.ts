import assert from "node:assert/strict";
import test from "node:test";
import { CustomerService, buildCustomerQuery, parseGetCustomer, parseSearchCustomers } from "../../src/quickbooks/services/customer.service.js";
import type { QuickBooksApi } from "../../src/quickbooks/client/quickbooks-client.js";
import { NotFoundError, ValidationError } from "../../src/types/errors.js";

test("customer search maps a page and keeps the query narrow", async () => {
  let statement = "";
  const api: QuickBooksApi = {
    async query(value) {
      statement = value;
      return {
        QueryResponse: {
          Customer: {
            Id: "10",
            DisplayName: "Ada Lovelace",
            CompanyName: "Analytical Engines",
            PrimaryEmailAddr: { Address: "ada@example.com" },
            PrimaryPhone: { FreeFormNumber: "555-0100" },
            Active: true,
          },
        },
      };
    },
    async get() {
      throw new Error("not used");
    },
    async post() {
      throw new Error("not used");
    },
  };
  const result = await new CustomerService(api).search(
    parseSearchCustomers({ display_name: "O'Brien%", active: true, limit: 5 }),
  );
  assert.equal(result.count, 1);
  assert.equal(result.customers[0]?.email, "ada@example.com");
  assert.equal(result.customers[0]?.phone, "555-0100");
  assert.equal(
    statement,
    "SELECT * FROM Customer WHERE DisplayName LIKE '%O''Brien%' AND Active = true STARTPOSITION 1 MAXRESULTS 5",
  );
});

test("an empty customer query is an empty page", async () => {
  const api: QuickBooksApi = {
    async query() {
      return { QueryResponse: {} };
    },
    async get() {
      throw new Error("not used");
    },
    async post() {
      throw new Error("not used");
    },
  };
  const result = await new CustomerService(api).search(parseSearchCustomers({}));
  assert.deepEqual(result.customers, []);
  assert.equal(result.limit, 20);
});

test("get customer rejects a bad id and maps not found", async () => {
  assert.throws(() => parseGetCustomer({ customer_id: "abc" }), ValidationError);
  const api: QuickBooksApi = {
    async query() {
      throw new Error("not used");
    },
    async get() {
      throw new NotFoundError("missing", 400, "610");
    },
    async post() {
      throw new Error("not used");
    },
  };
  await assert.rejects(() => new CustomerService(api).get(parseGetCustomer({ customer_id: "15" })), /No customer was found for id 15/);
});

test("customer query escapes quotes", () => {
  const statement = buildCustomerQuery(parseSearchCustomers({ display_name: "Tom's" }));
  assert.match(statement, /Tom''s/);
});
