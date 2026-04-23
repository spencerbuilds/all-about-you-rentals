/* =========================================
   ALL ABOUT YOU RENTALS — SCRIPTS
   ========================================= */

/* --- CART: Initialize badge count on every page --- */
(function initCartBadge() {
  const CART_KEY = 'aay_cart';
  function getCartCount() {
    try {
      const cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
      return cart.reduce((sum, item) => sum + (item.qty || 0), 0);
    } catch (e) {
      return 0;
    }
  }
  function updateBadges() {
    const count = getCartCount();
    document.querySelectorAll('.cart-count-badge').forEach(el => {
      el.textContent = count;
      el.classList.toggle('cart-count-badge--hidden', count === 0);
    });
  }
  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateBadges);
  } else {
    updateBadges();
  }
  // Also update when localStorage changes in another tab
  window.addEventListener('storage', e => {
    if (e.key === CART_KEY) updateBadges();
  });
})();


/* --- NAV: Scroll behavior & mobile toggle --- */
const nav = document.getElementById('nav');
const navBurger = document.getElementById('navBurger');
const navMobile = document.getElementById('navMobile');

// Only apply scroll-based transparency on the home page (has a hero)
const isHomePage = !!document.querySelector('.hero');

if (isHomePage) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  });
} // Inner pages already have nav--solid applied in HTML

navBurger.addEventListener('click', () => {
  navMobile.classList.toggle('open');
});

navMobile.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navMobile.classList.remove('open'));
});


/* --- STATS: Count-up animation --- */
function animateCount(el) {
  const target = parseInt(el.dataset.target, 10);
  const duration = 1800;
  const start = performance.now();

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = target.toLocaleString();
  }
  requestAnimationFrame(update);
}

const statsSection = document.querySelector('.stats');
if (statsSection) {
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.stats__number').forEach(animateCount);
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  statsObserver.observe(statsSection);
}


/* --- FADE-UP: Scroll reveal --- */
const fadeTargets = [
  '.rental-card',
  '.about__text',
  '.about__image-stack',
  '.home-about__text',
  '.home-about__images',
  '.contact__info',
  '.contact__form',
  '.stats__item',
  '.value-card',
  '.home-review-card',
  '.review-card-full',
  '.gallery__item',
];
document.querySelectorAll(fadeTargets.join(',')).forEach(el => {
  el.classList.add('fade-up');
});

const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.fade-up').forEach(el => fadeObserver.observe(el));


/* --- TESTIMONIALS: Carousel (home page only) --- */
const track = document.getElementById('testimonialsTrack');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const dotsContainer = document.getElementById('testimonialDots');

if (track && prevBtn && nextBtn) {
  const cards = track.querySelectorAll('.testimonial-card');
  let current = 0;
  let perView = getPerView();
  const total = Math.ceil(cards.length / perView);

  function getPerView() {
    if (window.innerWidth < 640) return 1;
    if (window.innerWidth < 900) return 2;
    return 3;
  }

  function buildDots() {
    dotsContainer.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('button');
      dot.className = 'dot' + (i === current ? ' active' : '');
      dot.setAttribute('aria-label', `Slide ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      dotsContainer.appendChild(dot);
    }
  }

  function goTo(index) {
    current = Math.max(0, Math.min(index, total - 1));
    const cardWidth = cards[0].offsetWidth + 24;
    track.style.transform = `translateX(-${current * perView * cardWidth}px)`;
    dotsContainer.querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));

  let autoplay = setInterval(() => goTo((current + 1) % total), 5000);
  track.addEventListener('mouseenter', () => clearInterval(autoplay));
  track.addEventListener('mouseleave', () => {
    autoplay = setInterval(() => goTo((current + 1) % total), 5000);
  });

  window.addEventListener('resize', () => {
    const newPerView = getPerView();
    if (newPerView !== perView) {
      perView = newPerView;
      current = 0;
      buildDots();
      goTo(0);
    }
  });

  buildDots();
}


/* --- CONTACT FORM: Submit feedback --- */
const contactForm = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');

if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('button[type="submit"]');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    setTimeout(() => {
      formSuccess.classList.add('visible');
      contactForm.reset();
      btn.textContent = 'Send Message';
      btn.disabled = false;
      setTimeout(() => formSuccess.classList.remove('visible'), 5000);
    }, 1200);
  });
}


/* --- SMOOTH SCROLL (home page anchor links) --- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const navH = nav.offsetHeight;
    const top = target.getBoundingClientRect().top + window.scrollY - navH;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});
