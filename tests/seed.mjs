// Two isolated companies plus a system owner.
//
// Connects as the superuser on purpose: seeding must bypass RLS to place rows
// in more than one company. The suites then connect as the application does,
// which is where the isolation is actually exercised.

import pg from "pg";
import bcrypt from "bcryptjs";
import { DB_URL } from "./lib.mjs";

export async function seed() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();

  const hash = await bcrypt.hash("test1234", 10);

  await client.query(`
    truncate table invoice_items, invoices, quotation_items, quotations,
      account_transactions, accounts, products, categories, customers,
      warehouses, invoice_settings, users, companies restart identity cascade
  `);

  const { rows: companies } = await client.query(`
    insert into companies (name, is_active, join_code)
    values ('شركة ألفا', true, 'ALFA2345'), ('شركة بيتا', true, 'BETA6789')
    returning id, name
  `);
  const [alpha, beta] = companies;

  await client.query(
    `insert into users (username, password_hash, name, role, status, company_id) values
       ('owner',   $1, 'مالك النظام', 'owner',   'active', null),
       ('admin_a', $1, 'أدمن ألفا',   'admin',   'active', $2),
       ('admin_b', $1, 'أدمن بيتا',   'admin',   'active', $3),
       ('cash_a',  $1, 'كاشير ألفا',  'cashier', 'active', $2)`,
    [hash, alpha.id, beta.id],
  );

  for (const company of [alpha, beta]) {
    const tag = company.name.split(" ")[1];

    const { rows: category } = await client.query(
      `insert into categories (name, company_id) values ($1, $2) returning id`,
      [`فئة ${tag}`, company.id],
    );
    await client.query(
      `insert into products (name, price, cost_price, stock, category_id, company_id)
       values ($1, '100', '60', 10, $3, $2), ($4, '200', '120', 5, $3, $2)`,
      [`منتج ${tag} ١`, company.id, category[0].id, `منتج ${tag} ٢`],
    );
    await client.query(`insert into customers (name, phone, company_id) values ($1, '0100', $2)`, [
      `عميل ${tag}`,
      company.id,
    ]);
    await client.query(
      `insert into accounts (name, type, initial_balance, company_id) values ($1, 'cash', '0', $2)`,
      [`خزينة ${tag}`, company.id],
    );
    await client.query(`insert into warehouses (name, company_id) values ($1, $2)`, [
      `مخزن ${tag}`,
      company.id,
    ]);
    await client.query(
      `insert into invoice_settings (company_name, company_id) values ($1, $2)`,
      [company.name, company.id],
    );
    // نفس رقم الفاتورة في الشركتين: يثبت أن الترقيم مستقل لكل شركة.
    await client.query(
      `insert into invoices (invoice_number, subtotal, discount, tax, total, payment_method, status, company_id)
       values ('INV-00001', '100', '0', '14', '114', 'cash', 'paid', $1)`,
      [company.id],
    );
  }

  await client.end();
  return { alpha, beta };
}

if (import.meta.filename === process.argv[1]) {
  await seed();
  console.log("seeded");
}
