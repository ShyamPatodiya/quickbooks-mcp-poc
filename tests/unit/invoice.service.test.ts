import assert from "node:assert/strict";
import test from "node:test";
import type { QuickBooksApi } from "../../src/quickbooks/client/quickbooks-client.js";
import {
  InvoiceService,
  buildCreateInvoiceBody,
  parseCreateInvoice,
  parseSearchInvoices,
} from "../../src/quickbooks/services/invoice.service.js";
import { QuickBooksApiError, ValidationError, WriteDisabledError } from "../../src/types/errors.js";

test("invoice search filters by customer and id", async () => {
  let statement = "";
  const api: QuickBooksApi = {
    async query(value) {
      statement = value;
      return { QueryResponse: { Invoice: [] } };
    },
    async get() {
      throw new Error("not used");
    },
    async post() {
      throw new Error("not used");
    },
  };
  await new InvoiceService(api, false).search(parseSearchInvoices({ customer_id: "10", invoice_id: "20", limit: 5 }));
  assert.match(statement, /CustomerRef = '10'/);
  assert.match(statement, /Id = '20'/);
  assert.match(statement, /MAXRESULTS 5/);
});

test("get invoice returns sales lines and hides the raw envelope", async () => {
  const api: QuickBooksApi = {
    async query() {
      throw new Error("not used");
    },
    async get() {
      return {
        Invoice: {
          Id: "20",
          DocNumber: "1001",
          CustomerRef: { value: "10" },
          TotalAmt: 25,
          Balance: 25,
          Line: [
            { DetailType: "SubTotalLineDetail", Amount: 25 },
            {
              DetailType: "SalesItemLineDetail",
              Description: "Consulting",
              Amount: 25,
              SalesItemLineDetail: { ItemRef: { value: "3" }, Qty: 1, UnitPrice: 25 },
            },
          ],
        },
      };
    },
    async post() {
      throw new Error("not used");
    },
  };
  const invoice = await new InvoiceService(api, false).get({ invoice_id: "20" });
  assert.equal(invoice.doc_number, "1001");
  assert.equal(invoice.line_items?.length, 1);
  assert.equal(invoice.line_items?.[0]?.item_id, "3");
  assert.equal("Invoice" in invoice, false);
});

test("create invoice maps clean input into the QuickBooks payload", async () => {
  const input = parseCreateInvoice({
    customer_id: "10",
    line_items: [{ item_id: "3", description: "Consulting", quantity: 2, unit_price: 10.5 }],
  });
  const payload = buildCreateInvoiceBody(input);
  assert.deepEqual(payload, {
    CustomerRef: { value: "10" },
    Line: [
      {
        DetailType: "SalesItemLineDetail",
        Amount: 21,
        Description: "Consulting",
        SalesItemLineDetail: {
          ItemRef: { value: "3" },
          Qty: 2,
          UnitPrice: 10.5,
        },
      },
    ],
  });

  let posted: unknown;
  const api: QuickBooksApi = {
    async query() {
      throw new Error("not used");
    },
    async get() {
      throw new Error("not used");
    },
    async post(_entity, body) {
      posted = body;
      return { Invoice: { Id: "99", TotalAmt: 21, Balance: 21, CustomerRef: { value: "10" } } };
    },
  };
  const created = await new InvoiceService(api, false).create(input);
  assert.deepEqual(posted, payload);
  assert.equal(created.id, "99");
});

test("create invoice validates required values and can be locked", async () => {
  assert.throws(() => parseCreateInvoice({ customer_id: "10", line_items: [] }), ValidationError);
  assert.throws(
    () => parseCreateInvoice({ customer_id: "10", line_items: [{ item_id: "", quantity: 1, unit_price: 1 }] }),
    ValidationError,
  );
  let called = false;
  const api: QuickBooksApi = {
    async query() {
      throw new Error("not used");
    },
    async get() {
      throw new Error("not used");
    },
    async post() {
      called = true;
      throw new Error("should not post");
    },
  };
  await assert.rejects(
    () =>
      new InvoiceService(api, true).create(
        parseCreateInvoice({ customer_id: "10", line_items: [{ item_id: "3", quantity: 1, unit_price: 1 }] }),
      ),
    WriteDisabledError,
  );
  assert.equal(called, false);
});

test("QuickBooks API errors from invoice reads are not swallowed", async () => {
  const api: QuickBooksApi = {
    async query() {
      throw new QuickBooksApiError("Validation fault", 400, "2020");
    },
    async get() {
      throw new Error("not used");
    },
    async post() {
      throw new Error("not used");
    },
  };
  await assert.rejects(() => new InvoiceService(api, false).search(parseSearchInvoices({})), QuickBooksApiError);
});
