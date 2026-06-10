(function () {
  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function scheduleIdle(callback) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(callback, { timeout: 1200 });
      return;
    }
    window.setTimeout(callback, 80);
  }

  function isConstrainedConnection() {
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return false;
    return Boolean(connection.saveData || /(^|-)2g$/.test(connection.effectiveType || ''));
  }

  function hasRealSource(video) {
    if (!video || video.dataset.placeholder === 'true') return false;
    if (video.dataset.src && video.dataset.src.trim()) return true;
    return Array.prototype.some.call(video.querySelectorAll('source'), function (source) {
      return Boolean(source.dataset.src && source.dataset.src.trim());
    });
  }

  function hydrateVideo(video) {
    if (!video || video.dataset.placeholder === 'true' || video.dataset.hydrated === 'true') return false;
    if (!hasRealSource(video)) return false;
    if (prefersReducedMotion && video.hasAttribute('autoplay')) {
      video.removeAttribute('autoplay');
    }

    if (video.dataset.src && !video.getAttribute('src')) {
      video.setAttribute('src', video.dataset.src);
    }

    Array.prototype.forEach.call(video.querySelectorAll('source'), function (source) {
      if (source.dataset.src && !source.getAttribute('src')) {
        source.setAttribute('src', source.dataset.src);
      }
    });

    video.dataset.hydrated = 'true';
    try {
      video.load();
    } catch (error) {
      return false;
    }
    return true;
  }

  function shouldAutoplay(video) {
    return video && video.hasAttribute('autoplay') && !prefersReducedMotion;
  }

  function playVideo(video) {
    if (!shouldAutoplay(video)) return;
    video.muted = true;
    var promise = video.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(function () {});
    }
  }

  function pauseVideo(video) {
    if (!video || video.paused) return;
    video.pause();
  }

  function isInsideInactivePanel(video) {
    var panel = video && video.closest('.tab-panel, .task-panel');
    return Boolean(panel && !panel.classList.contains('active'));
  }

  function hydratePanelVideos(panel, nearOnly) {
    if (!panel) return;
    Array.prototype.forEach.call(panel.querySelectorAll('video'), function (video) {
      if (video.dataset.placeholder === 'true' || !hasRealSource(video)) return;
      if (shouldAutoplay(video)) {
        video.muted = true;
      }
      if (video.closest('.summary-video-shell')) {
        return;
      }
      if (nearOnly) {
        var rect = video.getBoundingClientRect();
        var margin = 480;
        var nearViewport = rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
        if (!nearViewport) return;
      }
      hydrateVideo(video);
      playVideo(video);
    });
  }

  function setupSectionReveal() {
    var sections = document.querySelectorAll('#overview, #summaryvideo, #method, #experiments');
    if (!sections.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      sections.forEach(function (section) {
        section.classList.add('section-reveal', 'is-visible');
      });
      return;
    }

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
  }

  function setupToc() {
    var nav = document.getElementById('toc-nav');
    if (!nav) return;

    var firstMainSection = document.getElementById('overview');
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
      if (!grouped.length) return;
      var marker = window.innerHeight * 0.26;
      var current = null;

      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 120) {
        current = grouped[grouped.length - 1];
      }

      if (!current) {
        grouped.forEach(function (item) {
          var rect = item.node.getBoundingClientRect();
          if (rect.top <= marker) {
            current = item;
          }
        });
      }

      if (!current) {
        grouped.forEach(function (item) {
          if (current) return;
          var rect = item.node.getBoundingClientRect();
          if (rect.top <= marker && rect.bottom >= marker) {
            current = item;
          }
        });
      }

      if (!current) {
        current = grouped.find(function (item) {
          return item.node.getBoundingClientRect().top > marker;
        }) || grouped[grouped.length - 1];
      }

      links.forEach(function (link) {
        link.classList.remove('active', 'active-parent');
      });

      if (current && current.links.some(function (link) { return link.classList.contains('toc-link-sub'); })) {
        var currentParent = current.node.closest('section[id]');
        if (currentParent && currentParent.id !== current.node.id && byId[currentParent.id]) {
          byId[currentParent.id].links.forEach(function (link) {
            link.classList.add('active-parent');
          });
        }
      }

      current.links.forEach(function (link) {
        link.classList.add('active');
      });
    };

    updateActiveLink();
    window.addEventListener('scroll', updateActiveLink, { passive: true });
    window.addEventListener('resize', updateActiveLink);
  }

  function setupTabs() {
    document.querySelectorAll('.tab-bar[data-tabgroup]').forEach(function (tabBar) {
      var group = tabBar.dataset.tabgroup;
      var buttons = tabBar.querySelectorAll('.tab-btn[data-tab]');
      var panels = document.querySelectorAll('.tab-panel[data-tabgroup="' + group + '"]');

      function activate(targetConfig) {
        buttons.forEach(function (button) {
          var active = button.dataset.tab === targetConfig;
          button.classList.toggle('active', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        panels.forEach(function (panel) {
          var active = panel.dataset.config === targetConfig;
          panel.classList.toggle('active', active);
          panel.hidden = !active;
          if (!active) {
            Array.prototype.forEach.call(panel.querySelectorAll('video'), pauseVideo);
          }
        });

        var activePanel = document.querySelector('.tab-panel[data-tabgroup="' + group + '"][data-config="' + targetConfig + '"]');
        scheduleIdle(function () {
          hydratePanelVideos(activePanel, true);
        });
      }

      buttons.forEach(function (button) {
        button.addEventListener('click', function () {
          activate(button.dataset.tab);
        });

        button.addEventListener('keydown', function (event) {
          if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
          event.preventDefault();
          var list = Array.prototype.slice.call(buttons);
          var current = list.indexOf(button);
          var offset = event.key === 'ArrowRight' ? 1 : -1;
          var next = list[(current + offset + list.length) % list.length];
          next.focus();
          activate(next.dataset.tab);
        });
      });

      var initial = tabBar.querySelector('.tab-btn.active[data-tab]') || buttons[0];
      if (initial) activate(initial.dataset.tab);
    });
  }

  function hydrateDeferredImage(image) {
    if (!image || image.dataset.hydrated === 'true') return;
    var source = image.dataset.src;
    if (!source) return;
    image.src = source;
    image.dataset.hydrated = 'true';
  }

  function setupCalibrationDetails() {
    var details = document.getElementById('calibration-details');
    if (!details) return;

    var buttons = details.querySelectorAll('.calibration-tab-btn[data-calibration-tab]');
    var panels = details.querySelectorAll('.calibration-tab-panel[data-calibration-panel]');

    function activePanel() {
      return details.querySelector('.calibration-tab-panel.active[data-calibration-panel]');
    }

    function hydrateActivePanel() {
      if (!details.open) return;
      var panel = activePanel();
      if (!panel) return;
      hydrateDeferredImage(panel.querySelector('img[data-src]'));
    }

    function activate(target) {
      buttons.forEach(function (button) {
        var active = button.dataset.calibrationTab === target;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        button.tabIndex = active ? 0 : -1;
      });

      panels.forEach(function (panel) {
        var active = panel.dataset.calibrationPanel === target;
        panel.classList.toggle('active', active);
        panel.hidden = !active;
      });

      hydrateActivePanel();
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        activate(button.dataset.calibrationTab);
      });

      button.addEventListener('keydown', function (event) {
        var keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
        if (keys.indexOf(event.key) === -1) return;
        event.preventDefault();

        var list = Array.prototype.slice.call(buttons);
        var current = list.indexOf(button);
        var next = button;
        if (event.key === 'Home') {
          next = list[0];
        } else if (event.key === 'End') {
          next = list[list.length - 1];
        } else {
          var offset = event.key === 'ArrowRight' ? 1 : -1;
          next = list[(current + offset + list.length) % list.length];
        }
        next.focus();
        activate(next.dataset.calibrationTab);
      });
    });

    details.addEventListener('toggle', function () {
      if (details.open) hydrateActivePanel();
    });
  }

  function setupTaskExplorer() {
    var selector = document.querySelector('[data-task-selector]');
    if (!selector) return;

    var buttons = selector.querySelectorAll('.task-selector-btn[data-task]');
    var panels = document.querySelectorAll('.task-panel[data-task-panel]');
    var copy = document.getElementById('task-copy');
    var bars = document.querySelectorAll('[data-task-chart] .task-score-bar');
    var chartTitle = document.querySelector('[data-task-chart-title]');
    var chartAnimations = [];
    var taskData = {
      tube: {
        title: 'Tube Insertion',
        copy: 'Tube Insertion stresses local contact correction after the tube is close to the hole but visually ambiguous. Tactile feedback helps the policy recover from lateral and angular offsets instead of repeating the same pre-insertion pose.',
        scores: [35, 50, 70]
      },
      puzzle: {
        title: 'Do Puzzle',
        copy: 'Do Puzzle requires a longer sequence of contact-rich placements. RL post-training helps the policy continue after partial completion instead of stopping at the first visually plausible state.',
        scores: [25, 25, 45]
      },
      'assembly-1': {
        title: 'Assembly #1',
        copy: 'Assembly #1 emphasizes precise insertion and release under occlusion. Tactile feedback supports local search and axis realignment when the visual target is blocked.',
        scores: [80, 45, 95]
      },
      'assembly-2': {
        title: 'Assembly #2',
        copy: 'Assembly #2 combines partial insertion, occlusion, and contact ambiguity. The real-data anchor is especially important here because it preserves transfer while simulator RL improves recovery.',
        scores: [60, 55, 80]
      }
    };

    function displayedScore(value, fallback) {
      if (!value) return fallback;
      var parsed = parseFloat(value.textContent);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    function animateScoreValue(value, from, to, index) {
      if (!value) return;
      if (chartAnimations[index]) {
        window.cancelAnimationFrame(chartAnimations[index]);
        chartAnimations[index] = null;
      }

      if (prefersReducedMotion || from === to || !('requestAnimationFrame' in window)) {
        value.textContent = to + '%';
        return;
      }

      var startTime = null;
      var duration = 520;
      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = from + ((to - from) * eased);
        value.textContent = Math.round(current) + '%';
        if (progress < 1) {
          chartAnimations[index] = window.requestAnimationFrame(step);
        } else {
          value.textContent = to + '%';
          chartAnimations[index] = null;
        }
      }

      chartAnimations[index] = window.requestAnimationFrame(step);
    }

    function updateChart(scores) {
      bars.forEach(function (bar, index) {
        var score = scores[index];
        if (typeof score !== 'number') return;
        bar.setAttribute('aria-label', bar.querySelector('.task-score-bar-label').textContent + ' real-world success ' + score + ' percent');
        var value = bar.querySelector('.task-score-bar-value');
        animateScoreValue(value, displayedScore(value, score), score, index);
        bar.style.setProperty('--score', score);
      });
    }

    function activate(task) {
      var data = taskData[task] || taskData.tube;

      buttons.forEach(function (button) {
        var active = button.dataset.task === task;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        button.tabIndex = active ? 0 : -1;
      });

      panels.forEach(function (panel) {
        var active = panel.dataset.taskPanel === task;
        panel.classList.toggle('active', active);
        panel.hidden = !active;
        if (!active) {
          Array.prototype.forEach.call(panel.querySelectorAll('video'), pauseVideo);
        }
      });

      if (copy) copy.textContent = data.copy;
      if (chartTitle) chartTitle.textContent = data.title;
      updateChart(data.scores);

      var activePanel = document.querySelector('.task-panel[data-task-panel="' + task + '"]');
      scheduleIdle(function () {
        hydratePanelVideos(activePanel, true);
      });
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        activate(button.dataset.task);
      });

      button.addEventListener('keydown', function (event) {
        var keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
        if (keys.indexOf(event.key) === -1) return;
        event.preventDefault();

        var list = Array.prototype.slice.call(buttons);
        var current = list.indexOf(button);
        var next = button;
        if (event.key === 'Home') {
          next = list[0];
        } else if (event.key === 'End') {
          next = list[list.length - 1];
        } else {
          var offset = event.key === 'ArrowRight' ? 1 : -1;
          next = list[(current + offset + list.length) % list.length];
        }
        next.focus();
        activate(next.dataset.task);
      });
    });

    var initial = selector.querySelector('.task-selector-btn.active[data-task]') || buttons[0];
    if (initial) activate(initial.dataset.task);
  }

  function setupVideoLazyLoading() {
    var videos = Array.prototype.filter.call(document.querySelectorAll('video'), function (video) {
      return video.dataset.placeholder !== 'true' && hasRealSource(video);
    });
    if (!videos.length) return;

    var constrained = isConstrainedConnection();
    var nearMargin = constrained ? '220px 0px' : '420px 0px';

    function maybeHydrateAndPlay(video) {
      if (!video || isInsideInactivePanel(video)) return;
      if (video.closest('.summary-video-shell') && constrained) return;
      hydrateVideo(video);
      playVideo(video);
    }

    if (!('IntersectionObserver' in window)) {
      videos.forEach(function (video) {
        scheduleIdle(function () {
          maybeHydrateAndPlay(video);
        });
      });
      return;
    }

    var nearObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var video = entry.target;
        scheduleIdle(function () {
          maybeHydrateAndPlay(video);
        });
      });
    }, { rootMargin: nearMargin, threshold: 0.2 });

    var playObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25 && !isInsideInactivePanel(video)) {
          maybeHydrateAndPlay(video);
        } else {
          pauseVideo(video);
        }
      });
    }, { threshold: [0, 0.25, 0.6] });

    videos.forEach(function (video) {
      if (prefersReducedMotion && video.hasAttribute('autoplay')) {
        video.removeAttribute('autoplay');
      }

      nearObserver.observe(video);
      playObserver.observe(video);

      if (video.controls) {
        video.addEventListener('pointerdown', function () {
          hydrateVideo(video);
        }, { once: true });
        video.addEventListener('focus', function () {
          hydrateVideo(video);
        }, { once: true });
      }
    });
  }

  setupSectionReveal();
  setupToc();
  setupTabs();
  setupTaskExplorer();
  setupCalibrationDetails();
  setupVideoLazyLoading();
})();
