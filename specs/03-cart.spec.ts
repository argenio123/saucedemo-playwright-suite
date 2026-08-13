import { test, expect } from '../fixtures/test';
import { PRODUCT_NAMES, priceOf } from '../data/products';
import { note } from '../utils/report';

/**
 * Shopping cart behaviour and persistence.
 * Covers TC-027 to TC-036.
 */
test.describe('Shopping cart @S95f3b7eb', () => {

  test('TC-027 Adding one product sets the cart badge to 1 @T7e6d2b9a', async ({ shopper }, testInfo) => {
    await expect(shopper.cartBadge).toHaveCount(0);
    await shopper.addToCart('Sauce Labs Backpack');

    await expect(shopper.cartBadge).toHaveText('1');
    await expect(shopper.card('Sauce Labs Backpack').getByRole('button', { name: 'Remove' })).toBeVisible();

    note(testInfo, 'From an empty cart, adding the Sauce Labs Backpack raised the badge to 1 and the card control switched from "Add to cart" to "Remove".');
  });

  test('TC-028 Adding every product sets the cart badge to 6 @T716c7601', async ({ shopper }, testInfo) => {
    for (const name of PRODUCT_NAMES) {
      await shopper.addToCart(name);
    }

    await expect(shopper.cartBadge).toHaveText('6');
    note(testInfo, `All six catalogue items were added in sequence and the badge tracked each addition, finishing at 6: ${PRODUCT_NAMES.join(', ')}.`);
  });

  test('TC-029 Removing a product from the catalogue decrements the badge @T4e613262', async ({ shopper }, testInfo) => {
    await shopper.addToCart('Sauce Labs Backpack');
    await shopper.addToCart('Sauce Labs Bike Light');
    await expect(shopper.cartBadge).toHaveText('2');

    await shopper.removeFromCart('Sauce Labs Backpack');

    await expect(shopper.cartBadge).toHaveText('1');
    await expect(shopper.card('Sauce Labs Backpack').getByRole('button', { name: 'Add to cart' })).toBeVisible();

    note(testInfo, 'With two items in the cart, removing one from the catalogue page decremented the badge from 2 to 1 and restored that card\'s "Add to cart" control.');
  });

  test('TC-030 The cart lists exactly the products that were added @T71ed4c04', async ({ shopper, cartPage }, testInfo) => {
    const chosen = ['Sauce Labs Backpack', 'Sauce Labs Onesie', 'Sauce Labs Fleece Jacket'];
    for (const name of chosen) await shopper.addToCart(name);

    await shopper.openCart();
    await cartPage.expectLoaded();

    const listed = await cartPage.names();
    expect(listed.sort()).toEqual([...chosen].sort());
    await expect(cartPage.items).toHaveCount(3);

    note(testInfo, `Three specific products were added and the cart listed exactly those three with nothing else present: ${listed.join(', ')}.`);
  });

  test('TC-031 Each distinct product appears once with a quantity of 1 @T42f1f14a', async ({ shopper, cartPage }, testInfo) => {
    await shopper.addToCart('Sauce Labs Backpack');
    await shopper.addToCart('Sauce Labs Bike Light');
    await shopper.openCart();

    const quantities = await cartPage.quantityValues();
    expect(quantities).toEqual([1, 1]);

    note(testInfo, 'Each distinct product occupied one cart line with a quantity of 1. The catalogue offers no quantity control, so this confirms the one-line-per-product model rather than silent aggregation.');
  });

  test('TC-032 Removing from the cart page empties the cart @T6f5ad4ff', async ({ shopper, cartPage }, testInfo) => {
    await shopper.addToCart('Sauce Labs Backpack');
    await shopper.openCart();

    await cartPage.removeItem('Sauce Labs Backpack');

    await expect(cartPage.items).toHaveCount(0);
    await expect(shopper.cartBadge).toHaveCount(0);

    note(testInfo, 'Removing the only cart line left the cart with zero items and the badge disappeared entirely rather than displaying "0".');
  });

  test('TC-033 Continue shopping returns to the catalogue with the cart intact @T9836bfc5', async ({ shopper, cartPage }, testInfo) => {
    await shopper.addToCart('Sauce Labs Bolt T-Shirt');
    await shopper.openCart();

    await cartPage.continueShopping();

    await shopper.expectLoaded();
    await expect(shopper.cartBadge).toHaveText('1');

    note(testInfo, '"Continue Shopping" returned to the catalogue and the previously added item was preserved - the badge still showed 1 after the round trip.');
  });

  test('TC-034 Cart contents survive a page reload @T8f006853', async ({ shopper, page }, testInfo) => {
    await shopper.addToCart('Sauce Labs Backpack');
    await shopper.addToCart('Sauce Labs Onesie');
    await expect(shopper.cartBadge).toHaveText('2');

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(shopper.cartBadge).toHaveText('2');
    await expect(shopper.card('Sauce Labs Backpack').getByRole('button', { name: 'Remove' })).toBeVisible();

    note(testInfo, 'Two items survived a full page reload: the badge still read 2 and the affected cards still rendered their "Remove" state, so the basket is persisted rather than held only in memory.');
  });

  test('TC-035 Reset App State clears the cart @Tca0a6a55', async ({ shopper }, testInfo) => {
    await shopper.addToCart('Sauce Labs Backpack');
    await shopper.addToCart('Sauce Labs Bike Light');
    await expect(shopper.cartBadge).toHaveText('2');

    await shopper.resetAppState();

    await expect(shopper.cartBadge).toHaveCount(0);
    note(testInfo, 'The "Reset App State" menu action emptied a two-item cart and the badge was removed from the header.');
  });

  test('TC-036 A product can be added from its detail page @Td4b93b72', async ({ shopper, page, cartPage }, testInfo) => {
    const target = 'Sauce Labs Fleece Jacket';
    await shopper.openProduct(target);

    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(shopper.cartBadge).toHaveText('1');

    await shopper.cartLink.click();
    await cartPage.expectLoaded();

    expect(await cartPage.names()).toEqual([target]);
    expect(await cartPage.lineTotal()).toBe(priceOf(target));

    note(testInfo, `"${target}" was added from its detail page rather than the catalogue. The badge incremented to 1 and the cart held that single line at the correct price of $${priceOf(target).toFixed(2)}.`);
  });
});
