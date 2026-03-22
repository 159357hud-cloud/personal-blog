(function () {
  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
  }

  function countReadableUnits(value) {
    return (value.match(/[\p{Script=Han}]|[A-Za-z0-9_]+/gu) || []).length;
  }

  const revealItems = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && revealItems.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  const postCards = Array.from(document.querySelectorAll("[data-post-card]"));
  const filterSummary = document.querySelector("[data-filter-summary]");

  if (filterButtons.length > 0 && postCards.length > 0) {
    const applyFilter = (filter) => {
      let visibleCount = 0;

      postCards.forEach((card) => {
        const category = (card.getAttribute("data-category") || "").toLowerCase();
        const matched = filter === "all" || category === filter;
        card.classList.toggle("is-hidden", !matched);
        if (matched) {
          visibleCount += 1;
        }
      });

      filterButtons.forEach((button) => {
        button.classList.toggle("is-active", button.getAttribute("data-filter") === filter);
      });

      if (filterSummary) {
        filterSummary.textContent =
          filter === "all"
            ? "显示全部文章"
            : "当前分类：" + filterButtons.find((button) => button.getAttribute("data-filter") === filter)?.textContent;
        filterSummary.setAttribute("data-visible-count", String(visibleCount));
      }
    };

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        applyFilter(button.getAttribute("data-filter") || "all");
      });
    });

    applyFilter("all");
  }

  const titleInput = document.querySelector("[data-slug-source]");
  const slugInput = document.querySelector("[data-slug-target]");
  const slugPreview = document.querySelector("[data-slug-preview]");
  let slugTouched = Boolean(slugInput && slugInput.value.trim());

  function updateSlugPreview() {
    if (!slugPreview || !slugInput) {
      return;
    }

    const slug = slugInput.value.trim();
    slugPreview.textContent = slug ? "/post/" + slug : "/post/文章链接";
  }

  if (titleInput && slugInput) {
    titleInput.addEventListener("input", () => {
      if (!slugTouched) {
        slugInput.value = slugify(titleInput.value);
      }
      updateSlugPreview();
    });

    slugInput.addEventListener("input", () => {
      slugTouched = true;
      slugInput.value = slugify(slugInput.value);
      updateSlugPreview();
    });

    updateSlugPreview();
  }

  const editor = document.querySelector("[data-editor]");
  const wordCount = document.querySelector("[data-word-count]");

  function updateWordCount() {
    if (!editor || !wordCount) {
      return;
    }

    const total = countReadableUnits(editor.value);
    wordCount.textContent = total + " 字 / 词";
  }

  if (editor && wordCount) {
    updateWordCount();
    editor.addEventListener("input", updateWordCount);
  }

  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const message = form.getAttribute("data-confirm");
      if (message && !window.confirm(message)) {
        event.preventDefault();
      }
    });
  });

  document.querySelectorAll("textarea").forEach((textarea) => {
    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    };

    resize();
    textarea.addEventListener("input", resize);
  });
})();
