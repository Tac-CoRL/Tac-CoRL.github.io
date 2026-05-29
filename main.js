(function () {
  var sections = document.querySelectorAll('#demos, #method, #results, #rollouts, #analysis, #faq');
  var revealObs = new IntersectionObserver(function (entries, self) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      self.unobserve(entry.target);
    });
  }, { threshold: 0.04 });

  sections.forEach(function (section) {
    section.classList.add('section-reveal');
    revealObs.observe(section);
  });
})();

(function () {
  var nav = document.getElementById('toc-nav');
  if (!nav) return;

  var firstMainSection = document.getElementById('demos');
  var footer = document.getElementById('footer');
  var links = nav.querySelectorAll('.toc-link');

  if (firstMainSection) {
    var updateNavVisibility = function () {
      var triggerY = firstMainSection.offsetTop - (window.innerHeight * 0.18);
      var pastStart = window.scrollY >= triggerY;
      var atFooter = false;
      if (footer) {
        var footerRect = footer.getBoundingClientRect();
        atFooter = footerRect.top <= window.innerHeight * 0.98;
      }
      nav.classList.toggle('visible', pastStart && !atFooter);
    };

    updateNavVisibility();
    window.addEventListener('scroll', updateNavVisibility, { passive: true });
    window.addEventListener('resize', updateNavVisibility);
  }

  var grouped = [];
  var byId = {};
  links.forEach(function (link) {
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) !== '#') return;
    var id = href.slice(1);
    var node = document.getElementById(id);
    if (!node) return;
    if (!byId[id]) {
      byId[id] = { node: node, links: [] };
      grouped.push(byId[id]);
    }
    byId[id].links.push(link);
  });

  var updateActiveLink = function () {
    var marker = window.innerHeight * 0.26;
    var current = null;

    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 120) {
      current = grouped[grouped.length - 1];
    }

    grouped.forEach(function (item) {
      if (current) return;
      var rect = item.node.getBoundingClientRect();
      if (rect.top <= marker && rect.bottom >= marker) {
        current = item;
      }
    });

    if (!current) {
      current = grouped.find(function (item) {
        return item.node.getBoundingClientRect().top > marker;
      }) || grouped[grouped.length - 1];
    }

    links.forEach(function (link) {
      link.classList.remove('active');
    });

    if (current) {
      current.links.forEach(function (link) {
        link.classList.add('active');
      });
    }
  };

  updateActiveLink();
  window.addEventListener('scroll', updateActiveLink, { passive: true });
  window.addEventListener('resize', updateActiveLink);
})();
