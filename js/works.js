document.addEventListener("DOMContentLoaded", () => {
  initWorksList();
  initLightbox();
});

// ============================================
// 実績一覧ページ（タブ絞り込み・もっと見る）
// ============================================
function initWorksList() {
  const grid = document.getElementById("worksGrid");
  if (!grid) return; // このページには一覧が無い

  // タブ（カテゴリが2件以上のときだけビルド時に出力される）が無い場合は
  // 常に「すべて」表示として振る舞う。
  const tabsWrap = document.getElementById("worksTabs");
  const cards = Array.from(grid.querySelectorAll(".work-card"));
  const tabs = tabsWrap ? Array.from(tabsWrap.querySelectorAll(".works-tabs__item")) : [];
  const emptyMessage = document.getElementById("worksEmpty");
  const countLabel = document.getElementById("worksCount");
  const loadMoreBtn = document.getElementById("worksLoadMore");

  const PAGE_SIZE = 12;
  let currentService = "all";
  let shownCount = PAGE_SIZE;

  function matchesCurrentService(card) {
    return currentService === "all" || card.dataset.service === currentService;
  }

  function applyFilter() {
    const matching = cards.filter(matchesCurrentService);

    cards.forEach((card) => {
      card.style.display = "none";
    });
    matching.slice(0, shownCount).forEach((card) => {
      card.style.display = "";
    });

    emptyMessage.hidden = matching.length > 0;

    const visibleCount = Math.min(shownCount, matching.length);
    countLabel.textContent = matching.length > 0 ? `${visibleCount} / ${matching.length}件` : "";

    loadMoreBtn.hidden = visibleCount >= matching.length;
  }

  function setActiveTab(serviceId) {
    tabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.service === serviceId);
    });
  }

  function selectService(serviceId, { updateUrl } = { updateUrl: true }) {
    currentService = serviceId;
    shownCount = PAGE_SIZE;
    setActiveTab(serviceId);
    applyFilter();

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (serviceId === "all") {
        url.searchParams.delete("service");
      } else {
        url.searchParams.set("service", serviceId);
      }
      window.history.replaceState({}, "", url);
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectService(tab.dataset.service));
  });

  loadMoreBtn.addEventListener("click", () => {
    shownCount += PAGE_SIZE;
    applyFilter();
  });

  // 初期状態: URLの ?service= を反映
  const initialService = new URL(window.location.href).searchParams.get("service");
  const hasTab = initialService && tabs.some((tab) => tab.dataset.service === initialService);
  selectService(hasTab ? initialService : "all", { updateUrl: false });
}

// ============================================
// 案件詳細ページ（ライトボックス）
// ============================================
function initLightbox() {
  const lightbox = document.getElementById("lightbox");
  const gallery = document.getElementById("workGallery");
  if (!lightbox || !gallery) return; // このページにはギャラリーが無い

  const img = document.getElementById("lightboxImg");
  const caption = document.getElementById("lightboxCaption");
  const closeBtn = document.getElementById("lightboxClose");
  const prevBtn = document.getElementById("lightboxPrev");
  const nextBtn = document.getElementById("lightboxNext");

  const photos = Array.from(gallery.querySelectorAll(".work-gallery__img"));
  let currentIndex = -1;

  function openAt(index) {
    currentIndex = (index + photos.length) % photos.length;
    const photo = photos[currentIndex];
    img.src = photo.dataset.lightboxSrc || photo.src;
    caption.textContent = photo.dataset.lightboxCaption || "";
    lightbox.classList.add("is-open");
  }

  function close() {
    lightbox.classList.remove("is-open");
    img.src = "";
  }

  photos.forEach((photo, index) => {
    photo.addEventListener("click", () => openAt(index));
  });

  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", () => openAt(currentIndex - 1));
  nextBtn.addEventListener("click", () => openAt(currentIndex + 1));

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) close();
  });

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") openAt(currentIndex - 1);
    if (e.key === "ArrowRight") openAt(currentIndex + 1);
  });

  // スワイプ操作（左右フリックで前後の写真へ）
  let touchStartX = null;
  lightbox.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].clientX;
  });
  lightbox.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const SWIPE_THRESHOLD = 40;
    if (deltaX > SWIPE_THRESHOLD) openAt(currentIndex - 1);
    else if (deltaX < -SWIPE_THRESHOLD) openAt(currentIndex + 1);
    touchStartX = null;
  });
}
