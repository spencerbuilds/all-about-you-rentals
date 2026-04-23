/* =========================================
   ALL ABOUT YOU RENTALS — CART PAGE LOGIC
   ========================================= */

const CART_KEY = 'aay_cart';
const DELIVERY_MINIMUM = 200;

/* --- Cart Utilities --- */

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function cartCount(cart) {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

/** Parse a price string like "$125" or "$1.25" to a float */
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const num = parseFloat(String(priceStr).replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}

/** Format cents/float to currency string */
function formatPrice(amount) {
  return '$' + amount.toFixed(2).replace(/\.00$/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Calculate subtotal of all items */
function calcSubtotal(cart) {
  return cart.reduce((sum, item) => sum + parsePrice(item.price) * item.qty, 0);
}

/** Update cart count badges in nav */
function updateCartBadges() {
  const count = cartCount(getCart());
  document.querySelectorAll('.cart-count-badge').forEach(el => {
    el.textContent = count;
    el.classList.toggle('cart-count-badge--hidden', count === 0);
  });
}


/* --- Render Cart Items --- */

function renderCart() {
  const cart = getCart();
  const container = document.getElementById('cartItems');
  const emptyState = document.getElementById('cartEmpty');
  const cartLayout = document.getElementById('cartLayout');
  const subtotalEl = document.getElementById('cartSubtotal');
  const deliveryToggle = document.getElementById('deliveryToggle');
  const deliveryNote = document.getElementById('deliveryNote');

  if (!container) return;

  updateCartBadges();

  if (cart.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (cartLayout) cartLayout.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (cartLayout) cartLayout.style.display = '';

  // Render each cart row
  container.innerHTML = '';
  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.dataset.id = item.id;

    const imgStyle = item.img
      ? `background-image:url('${item.img}')`
      : 'background-color:var(--ivory-dark)';

    row.innerHTML = `
      <div class="cart-item__img" style="${imgStyle}"></div>
      <div class="cart-item__details">
        <h3 class="cart-item__name">${item.name}</h3>
        <p class="cart-item__price">${item.price} each</p>
        <p class="cart-item__category">${item.category || ''}</p>
      </div>
      <div class="cart-item__controls">
        <div class="qty-selector">
          <button class="qty-selector__btn qty-decrease" type="button" aria-label="Decrease quantity">−</button>
          <span class="qty-selector__val">${item.qty}</span>
          <button class="qty-selector__btn qty-increase" type="button" aria-label="Increase quantity">+</button>
        </div>
        <p class="cart-item__line-total">${formatPrice(parsePrice(item.price) * item.qty)}</p>
        <button class="cart-item__remove" type="button" aria-label="Remove item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `;

    // Decrease qty
    row.querySelector('.qty-decrease').addEventListener('click', () => {
      const c = getCart();
      const entry = c.find(i => i.id === item.id);
      if (entry) {
        entry.qty -= 1;
        if (entry.qty <= 0) {
          const idx = c.indexOf(entry);
          c.splice(idx, 1);
        }
      }
      saveCart(c);
      renderCart();
    });

    // Increase qty
    row.querySelector('.qty-increase').addEventListener('click', () => {
      const c = getCart();
      const entry = c.find(i => i.id === item.id);
      if (entry) entry.qty += 1;
      saveCart(c);
      renderCart();
    });

    // Remove
    row.querySelector('.cart-item__remove').addEventListener('click', () => {
      const c = getCart().filter(i => i.id !== item.id);
      saveCart(c);
      renderCart();
    });

    container.appendChild(row);
  });

  // Update subtotal display
  const subtotal = calcSubtotal(cart);
  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);

  // Update delivery toggle state
  if (deliveryToggle) {
    const canDeliver = subtotal >= DELIVERY_MINIMUM;
    deliveryToggle.disabled = !canDeliver;
    if (!canDeliver) {
      // Force back to pickup if delivery no longer available
      document.getElementById('optPickup').checked = true;
      deliveryToggle.checked = false;
    }
    if (deliveryNote) {
      deliveryNote.textContent = canDeliver
        ? 'Delivery available for your order.'
        : `Delivery available on orders $${DELIVERY_MINIMUM}+. Add more items to unlock.`;
      deliveryNote.classList.toggle('delivery-note--locked', !canDeliver);
    }
  }
}


/* --- Booking Form --- */

function initBookingForm() {
  const form = document.getElementById('bookingForm');
  if (!form) return;

  // Pickup / Delivery radio-based toggle
  const pickupRadio = document.getElementById('optPickup');
  const deliveryRadio = document.getElementById('optDelivery');
  const deliveryNote = document.getElementById('deliveryNote');

  function checkDelivery() {
    const subtotal = calcSubtotal(getCart());
    const canDeliver = subtotal >= DELIVERY_MINIMUM;
    if (deliveryRadio) {
      deliveryRadio.disabled = !canDeliver;
    }
    if (deliveryNote) {
      deliveryNote.textContent = canDeliver
        ? 'Delivery available for your order.'
        : `Delivery only on orders $${DELIVERY_MINIMUM}+. Your current order does not qualify.`;
      deliveryNote.classList.toggle('delivery-note--locked', !canDeliver);
    }
  }
  checkDelivery();

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const btn = form.querySelector('.booking-submit-btn');
    const successMsg = document.getElementById('bookingSuccess');
    const errorMsg = document.getElementById('bookingError');

    // Hide previous messages
    if (successMsg) successMsg.style.display = 'none';
    if (errorMsg) errorMsg.style.display = 'none';

    // Gather form data
    const formData = new FormData(form);
    const cart = getCart();

    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      eventDate: formData.get('eventDate'),
      eventType: formData.get('eventType'),
      fulfillment: formData.get('fulfillment'),
      specialRequests: formData.get('specialRequests'),
      cart: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty,
        category: item.category,
      })),
      subtotal: formatPrice(calcSubtotal(cart)),
      submittedAt: new Date().toISOString(),
    };

    btn.textContent = 'Submitting…';
    btn.disabled = true;

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Success: clear cart, show message
        localStorage.removeItem(CART_KEY);
        form.reset();
        if (successMsg) {
          successMsg.style.display = 'block';
          successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        renderCart(); // Will show empty state
      } else {
        throw new Error(`Server responded with ${res.status}`);
      }
    } catch (err) {
      console.error('Booking submission error:', err);
      if (errorMsg) {
        errorMsg.style.display = 'block';
        errorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } finally {
      btn.textContent = 'Submit Booking Request';
      btn.disabled = false;
    }
  });
}


/* --- Init on DOMContentLoaded --- */
document.addEventListener('DOMContentLoaded', () => {
  renderCart();
  initBookingForm();
});
