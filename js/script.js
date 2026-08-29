document.addEventListener("DOMContentLoaded", () => {
  const header = document.getElementById("header");
  const navToggle = document.getElementById("navToggle");
  const nav = document.getElementById("nav");

  // ヘッダーのスクロール状態切り替え
  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 10);
  };
  onScroll();
  window.addEventListener("scroll", onScroll);

  // モバイルメニューの開閉
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.classList.toggle("is-active", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.style.overflow = isOpen ? "hidden" : "";
  });

  // ナビリンククリックでメニューを閉じる
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      navToggle.classList.remove("is-active");
      navToggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    });
  });

  // スクロールで要素をフェードイン
  const animatedEls = document.querySelectorAll("[data-animate]");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  animatedEls.forEach((el) => observer.observe(el));

  // 事業内容の画像スライドショー（写真を一定間隔でクロスフェード切り替え）
  document.querySelectorAll(".business-item__visual--slideshow").forEach((visual) => {
    const slides = Array.from(visual.querySelectorAll(".business-item__slide"));
    if (slides.length < 2) return;

    // 2枚目以降は data-src で待機しているので、表示する前に読み込む。
    // 常に1枚先まで用意しておき、切り替わった瞬間に空白にならないようにする。
    const load = (index) => {
      const slide = slides[index];
      if (slide && slide.dataset.src) {
        slide.src = slide.dataset.src;
        delete slide.dataset.src;
      }
    };

    let current = slides.findIndex((slide) => slide.classList.contains("is-active"));
    if (current === -1) current = 0;
    load((current + 1) % slides.length);

    setInterval(() => {
      slides[current].classList.remove("is-active");
      current = (current + 1) % slides.length;
      slides[current].classList.add("is-active");
      load((current + 1) % slides.length);
    }, 4000);
  });

  // 表示範囲に入ってから少し待ち、不透明になる表示（事業内容・ニュース・会社概要）
  // セクションごとにひとつのブロックとして表示する。
  const revealEls = document.querySelectorAll(".scroll-reveal");
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add("is-visible");
          }, 200);
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealEls.forEach((el) => revealObserver.observe(el));
});
