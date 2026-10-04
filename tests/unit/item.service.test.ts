import assert from "node:assert/strict";
import test from "node:test";
import type { QuickBooksApi } from "../../src/quickbooks/client/quickbooks-client.js";
import { ItemService, parseSearchItems } from "../../src/quickbooks/services/item.service.js";
import { MalformedResponseError, QuickBooksApiError, ValidationError } from "../../src/types/errors.js";

test("item search maps name, type, price, and active status", async () => {
  let statement = "";
  const api: QuickBooksApi = {
    async query(value) {
      statement = value;
      return {
        QueryResponse: {
          Item: {
            Id: "3",
            Name: "Consulting",
            Type: "Service",
            Description: "Hourly consulting",
            UnitPrice: 150,
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
  const result = await new ItemService(api).search(parseSearchItems({ name: "Consult%", limit: 5 }));
  assert.equal(result.count, 1);
  assert.deepEqual(result.items[0], {
    id: "3",
    name: "Consulting",
    type: "Service",
    description: "Hourly consulting",
    unit_price: 150,
    active: true,
  });
  assert.equal(
    statement,
    "SELECT Id, Name, Type, Description, UnitPrice, Active FROM Item WHERE Name LIKE '%Consult%' STARTPOSITION 1 MAXRESULTS 5",
  );
});

test("an empty item query is an empty page and missing prices stay null", async () => {
  const api: QuickBooksApi = {
    async query() {
      return {
        QueryResponse: {
          Item: [{ Id: "9", Name: "Category A", Type: "Category" }],
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
  const result = await new ItemService(api).search(parseSearchItems({}));
  assert.equal(result.limit, 20);
  assert.equal(result.items[0]?.description, null);
  assert.equal(result.items[0]?.unit_price, null);
  assert.equal(result.items[0]?.active, null);
});

test("item search rejects a blank name and an item row without an id", async () => {
  assert.throws(() => parseSearchItems({ name: "   " }), ValidationError);
  const api: QuickBooksApi = {
    async query() {
      return { QueryResponse: { Item: [{ Name: "No id" }] } };
    },
    async get() {
      throw new Error("not used");
    },
    async post() {
      throw new Error("not used");
    },
  };
  await assert.rejects(() => new ItemService(api).search(parseSearchItems({})), MalformedResponseError);
});

test("QuickBooks API errors from item search are not swallowed", async () => {
  const api: QuickBooksApi = {
    async query() {
      throw new QuickBooksApiError("Validation fault", 400, "4000");
    },
    async get() {
      throw new Error("not used");
    },
    async post() {
      throw new Error("not used");
    },
  };
  await assert.rejects(() => new ItemService(api).search(parseSearchItems({})), QuickBooksApiError);
});
