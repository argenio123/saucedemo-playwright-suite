/**
 * Reference catalogue for https://www.saucedemo.com/
 *
 * Held here rather than read from the page under test, so that a price or a
 * name changing in the application is a test failure and not something the
 * suite silently absorbs.
 */

export type Product = {
  name: string;
  price: number;
  /** Fragment used by the site's own data-test attributes. */
  slug: string;
};

export const PRODUCTS: Product[] = [
  { name: 'Sauce Labs Backpack', price: 29.99, slug: 'sauce-labs-backpack' },
  { name: 'Sauce Labs Bike Light', price: 9.99, slug: 'sauce-labs-bike-light' },
  { name: 'Sauce Labs Bolt T-Shirt', price: 15.99, slug: 'sauce-labs-bolt-t-shirt' },
  { name: 'Sauce Labs Fleece Jacket', price: 49.99, slug: 'sauce-labs-fleece-jacket' },
  { name: 'Sauce Labs Onesie', price: 7.99, slug: 'sauce-labs-onesie' },
  { name: 'Test.allTheThings() T-Shirt (Red)', price: 15.99, slug: 'test.allthethings()-t-shirt-(red)' },
];

export const PRODUCT_NAMES = PRODUCTS.map(p => p.name);

/** The rate the checkout overview applies to the item total. */
export const TAX_RATE = 0.08;

export function priceOf(name: string): number {
  const hit = PRODUCTS.find(p => p.name === name);
  if (!hit) throw new Error(`Unknown product: ${name}`);
  return hit.price;
}

/** Money comparison that tolerates float noise but not a real discrepancy. */
export function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The checkout rounds the tax to the nearest cent rather than truncating it -
 * confirmed against the application on 13 Aug 2026, where an item total of
 * $29.99 produced $2.40 (2.3992 rounded up) and not $2.39.
 */
export function expectedTax(itemTotal: number): number {
  return Math.round(itemTotal * TAX_RATE * 100) / 100;
}

export const CHECKOUT_CUSTOMER = {
  firstName: 'Renejay',
  lastName: 'Quicay',
  postalCode: '4400',
};
