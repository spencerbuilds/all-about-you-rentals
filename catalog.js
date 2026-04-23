/* =========================================
   ALL ABOUT YOU RENTALS — CATALOG PAGE LOGIC
   ========================================= */

const CART_KEY = 'aay_cart';

/* --- Cart Utilities (shared) --- */

/** Read cart array from localStorage */
function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (e) {
    return [];
  }
}

/** Write cart array to localStorage */
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/** Total item count across all cart entries */
function cartCount(cart) {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

/** Update every cart count badge on the page */
function updateCartBadges() {
  const count = cartCount(getCart());
  document.querySelectorAll('.cart-count-badge').forEach(el => {
    el.textContent = count;
    el.classList.toggle('cart-count-badge--hidden', count === 0);
  });
  // Update sticky bar
  const bar = document.getElementById('catalogStickyBar');
  if (bar) {
    if (count > 0) {
      bar.classList.add('cart-sticky-bar--visible');
      const label = bar.querySelector('.cart-sticky-bar__label');
      if (label) label.textContent = `View Cart (${count} item${count !== 1 ? 's' : ''})`;
    } else {
      bar.classList.remove('cart-sticky-bar--visible');
    }
  }
}

/** Add item to cart or increment qty if already present */
function addToCart(product) {
  const cart = getCart();
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      priceRaw: product.priceRaw,
      qty: 1,
      img: product.img,
      category: product.category,
    });
  }
  saveCart(cart);
  updateCartBadges();
  showAddedFeedback(product.id);
}

/** Brief visual feedback on the "Add to Cart" button */
function showAddedFeedback(productId) {
  const btn = document.querySelector(`[data-product-id="${productId}"] .product-card__add-btn`);
  if (!btn) return;
  btn.textContent = 'Added!';
  btn.classList.add('product-card__add-btn--added');
  setTimeout(() => {
    btn.textContent = 'Add to Cart';
    btn.classList.remove('product-card__add-btn--added');
  }, 1200);
}


/* --- Catalog State --- */
let allProducts = [];   // Flat list of every product
let activeCategory = 'all';
let searchQuery = '';


/* --- DOM Helpers --- */

/** Build HTML-escaped product name (strip &amp; entities) */
function decodeEntities(str) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

/** Render a single product card */
function buildProductCard(product) {
  const name = decodeEntities(product.name);
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.productId = product.id;

  const imgStyle = product.img
    ? `background-image:url('${product.img}')`
    : 'background-color:var(--ivory-dark)';

  card.innerHTML = `
    <div class="product-card__img" style="${imgStyle}" role="img" aria-label="${name}"></div>
    <div class="product-card__body">
      <h3 class="product-card__name">${name}</h3>
      <div class="product-card__meta">
        <span class="product-card__price">${product.price}</span>
        <span class="qty-badge">${product.qty} available</span>
      </div>
      <button class="btn btn--primary btn--full product-card__add-btn" type="button">Add to Cart</button>
    </div>
  `;

  card.querySelector('.product-card__add-btn').addEventListener('click', () => {
    addToCart(product);
  });

  return card;
}

/** Render the product grid based on current filters */
function renderGrid() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  // Apply both filters simultaneously
  const filtered = allProducts.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = !searchQuery ||
      decodeEntities(p.name).toLowerCase().includes(searchQuery);
    return matchCat && matchSearch;
  });

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="catalog-empty">
        <p>No products match your search.</p>
        <button class="btn btn--outline" id="clearFiltersBtn">Clear Filters</button>
      </div>`;
    const clearBtn = grid.querySelector('#clearFiltersBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        activeCategory = 'all';
        searchQuery = '';
        document.querySelectorAll('.catalog-tab').forEach(t =>
          t.classList.toggle('catalog-tab--active', t.dataset.category === 'all')
        );
        const searchInput = document.getElementById('catalogSearch');
        if (searchInput) searchInput.value = '';
        renderGrid();
      });
    }
    return;
  }

  const frag = document.createDocumentFragment();
  filtered.forEach(p => frag.appendChild(buildProductCard(p)));
  grid.appendChild(frag);
}

/** Build category tab bar from unique categories */
function buildCategoryTabs(categories) {
  const tabBar = document.getElementById('catalogTabs');
  if (!tabBar) return;

  tabBar.innerHTML = '';

  // "All" tab first
  const allTab = document.createElement('button');
  allTab.className = 'catalog-tab catalog-tab--active';
  allTab.dataset.category = 'all';
  allTab.textContent = 'All';
  allTab.type = 'button';
  tabBar.appendChild(allTab);

  categories.forEach(cat => {
    const tab = document.createElement('button');
    tab.className = 'catalog-tab';
    tab.dataset.category = cat.id;
    tab.textContent = cat.name;
    tab.type = 'button';
    tabBar.appendChild(tab);
  });

  // Event delegation on tab bar
  tabBar.addEventListener('click', e => {
    const tab = e.target.closest('.catalog-tab');
    if (!tab) return;
    activeCategory = tab.dataset.category;
    tabBar.querySelectorAll('.catalog-tab').forEach(t =>
      t.classList.toggle('catalog-tab--active', t === tab)
    );
    renderGrid();
  });
}


/* --- Init on DOMContentLoaded --- */
document.addEventListener('DOMContentLoaded', () => {

  // Update cart badges immediately on page load
  updateCartBadges();

  // Wire up search input
  const searchInput = document.getElementById('catalogSearch');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderGrid();
    });
  }

  // Wire up sticky bar "View Cart" link (already an <a> in HTML, no extra JS needed)

  // Fetch product data
  fetch('/products.json')
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(categories => {
      // Flatten all products into a single array
      allProducts = categories.flatMap(cat => cat.products || []);

      // Build category tabs (use slug as id, name as label)
      buildCategoryTabs(categories.map(cat => ({ id: cat.id || cat.slug, name: cat.name })));

      // Initial render
      renderGrid();

      // Update product count in hero if element exists
      const countEl = document.getElementById('catalogProductCount');
      if (countEl) countEl.textContent = allProducts.length.toLocaleString();
    })
    .catch(err => {
      console.error('Failed to load products:', err);
      const grid = document.getElementById('catalogGrid');
      if (grid) {
        grid.innerHTML = `<div class="catalog-empty">
          <p>Unable to load products. Please refresh the page.</p>
        </div>`;
      }
    });
});
