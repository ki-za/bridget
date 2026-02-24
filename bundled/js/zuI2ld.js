import { c as createSignal, o as onMount, a as onCleanup, t as template, i as insert, b as createRenderEffect, s as setStyleProperty, u as useState, d as createEffect, e as expand, f as createComponent, S as Show, F as For, g as setAttribute, m as memo, h as on, j as use, k as classList, l as loadGsap, n as delegateEvents, p as increment, q as decrement, r as createMemo } from "./main.js";
var _tmpl$$3 = /* @__PURE__ */ template(`<div class=cursor><div class=cursorInner>`);
function CustomCursor(props) {
  let controller;
  const [xy, setXy] = createSignal({
    x: 0,
    y: 0
  });
  const [suppressed, setSuppressed] = createSignal(false);
  const onMouse = (e) => {
    const {
      clientX,
      clientY,
      target
    } = e;
    setXy({
      x: clientX,
      y: clientY
    });
    const elementUnderCursor = document.elementFromPoint(clientX, clientY);
    if (elementUnderCursor instanceof HTMLElement) {
      const cursorStyle = getComputedStyle(elementUnderCursor).cursor;
      const tag = elementUnderCursor.tagName;
      const isInteractiveElement = tag === "A" || tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const hasDefaultCursor = cursorStyle === "default" || cursorStyle === "text";
      const shouldSuppress = hasDefaultCursor || isInteractiveElement;
      setSuppressed(shouldSuppress);
    }
  };
  onMount(() => {
    controller = new AbortController();
    const abortSignal = controller.signal;
    window.addEventListener("mousemove", onMouse, {
      passive: true,
      signal: abortSignal
    });
  });
  onCleanup(() => {
    controller?.abort();
  });
  return (() => {
    var _el$ = _tmpl$$3(), _el$2 = _el$.firstChild;
    insert(_el$2, () => props.cursorText());
    createRenderEffect((_p$) => {
      var _v$ = !!props.active(), _v$2 = !!suppressed(), _v$3 = `translate3d(${xy().x}px, ${xy().y}px, 0)`;
      _v$ !== _p$.e && _el$.classList.toggle("active", _p$.e = _v$);
      _v$2 !== _p$.t && _el$.classList.toggle("suppressed", _p$.t = _v$2);
      _v$3 !== _p$.a && setStyleProperty(_el$, "transform", _p$.a = _v$3);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$;
  })();
}
const thresholdDiv = document.getElementsByClassName("threshold")[0];
const thresholdDispNums = Array.from(thresholdDiv.getElementsByClassName("num"));
const decButton = thresholdDiv.getElementsByClassName("dec").item(0);
const incButton = thresholdDiv.getElementsByClassName("inc").item(0);
const indexDiv = document.getElementsByClassName("index").item(0);
const indexDispNums = Array.from(indexDiv.getElementsByClassName("num"));
function updateThresholdText(thresholdValue) {
  thresholdDispNums.forEach((e, i) => {
    e.innerText = thresholdValue[i];
  });
}
function updateIndexText(indexValue, indexLength) {
  indexDispNums.forEach((e, i) => {
    if (i < 4) {
      e.innerText = indexValue[i];
    } else {
      e.innerText = indexLength[i - 4];
    }
  });
}
function Nav() {
  const [state, {
    incThreshold,
    decThreshold
  }] = useState();
  createEffect(() => {
    updateIndexText(expand(state().index + 1), expand(state().length));
    updateThresholdText(expand(state().threshold));
  });
  decButton.onclick = decThreshold;
  incButton.onclick = incThreshold;
  return null;
}
var _tmpl$$2 = /* @__PURE__ */ template(`<section class=contribution-tags><div class=tags-wrapper>`), _tmpl$2$2 = /* @__PURE__ */ template(`<a target=_blank rel="noopener noreferrer"class="link-button link-icon">Spotify`), _tmpl$3$1 = /* @__PURE__ */ template(`<a target=_blank rel="noopener noreferrer"class="link-button link-icon">Apple Music`), _tmpl$4 = /* @__PURE__ */ template(`<div class=project-links>`), _tmpl$5 = /* @__PURE__ */ template(`<div class=project-header><h3 class=project-name>`), _tmpl$6 = /* @__PURE__ */ template(`<p class=release-year>`), _tmpl$7 = /* @__PURE__ */ template(`<a target=_blank rel="noopener noreferrer">`), _tmpl$8 = /* @__PURE__ */ template(`<section class=track-list><h4 class=track-section-label>Tracks</h4><div class=track-items>`), _tmpl$9 = /* @__PURE__ */ template(`<div class=section-divider>`), _tmpl$0 = /* @__PURE__ */ template(`<div class=collaborator-list><h4 class=section-label>Collaborated:`), _tmpl$1 = /* @__PURE__ */ template(`<div class=released-by><h4 class=section-label>Released by:`), _tmpl$10 = /* @__PURE__ */ template(`<section class=metadata-section>`), _tmpl$11 = /* @__PURE__ */ template(`<div class=panel-container><div class=image-info-panel><div class=artist-section><h2 class=artist-name></h2></div><div class=section-divider></div><div class=content-constrained>`), _tmpl$12 = /* @__PURE__ */ template(`<span class=tag>`), _tmpl$13 = /* @__PURE__ */ template(`<div class=track-tags>`), _tmpl$14 = /* @__PURE__ */ template(`<div class=track-item><span class=track-name>`), _tmpl$15 = /* @__PURE__ */ template(`<span class=collaborator>`), _tmpl$16 = /* @__PURE__ */ template(`<span>`);
function ImageInfoPanel(props) {
  return createComponent(Show, {
    get when() {
      return props.info;
    },
    children: (info) => (() => {
      var _el$ = _tmpl$11(), _el$2 = _el$.firstChild, _el$0 = _el$2.firstChild, _el$10 = _el$0.firstChild, _el$12 = _el$0.nextSibling, _el$13 = _el$12.nextSibling;
      insert(_el$2, createComponent(Show, {
        get when() {
          return info().projectContributionTags?.length;
        },
        get children() {
          var _el$3 = _tmpl$$2(), _el$4 = _el$3.firstChild;
          insert(_el$4, createComponent(For, {
            get each() {
              return info().projectContributionTags;
            },
            children: (tag) => (() => {
              var _el$23 = _tmpl$12();
              setAttribute(_el$23, "data-tag", tag);
              insert(_el$23, tag);
              return _el$23;
            })()
          }));
          return _el$3;
        }
      }), _el$0);
      insert(_el$2, createComponent(Show, {
        get when() {
          return info().projectName;
        },
        get children() {
          var _el$5 = _tmpl$5(), _el$6 = _el$5.firstChild;
          insert(_el$6, () => info().projectName);
          insert(_el$5, createComponent(Show, {
            get when() {
              return info().spotifyLink || info().appleMusicLink;
            },
            get children() {
              var _el$7 = _tmpl$4();
              insert(_el$7, createComponent(Show, {
                get when() {
                  return info().spotifyLink;
                },
                get children() {
                  var _el$8 = _tmpl$2$2();
                  createRenderEffect(() => setAttribute(_el$8, "href", info().spotifyLink));
                  return _el$8;
                }
              }), null);
              insert(_el$7, createComponent(Show, {
                get when() {
                  return info().appleMusicLink;
                },
                get children() {
                  var _el$9 = _tmpl$3$1();
                  createRenderEffect(() => setAttribute(_el$9, "href", info().appleMusicLink));
                  return _el$9;
                }
              }), null);
              return _el$7;
            }
          }), null);
          return _el$5;
        }
      }), _el$0);
      insert(_el$0, createComponent(Show, {
        get when() {
          return info().releaseYear;
        },
        get children() {
          var _el$1 = _tmpl$6();
          insert(_el$1, () => info().releaseYear);
          return _el$1;
        }
      }), _el$10);
      insert(_el$10, createComponent(Show, {
        get when() {
          return info().artistLink;
        },
        get fallback() {
          return memo(() => info().artistName);
        },
        get children() {
          var _el$11 = _tmpl$7();
          insert(_el$11, () => info().artistName);
          createRenderEffect(() => setAttribute(_el$11, "href", info().artistLink));
          return _el$11;
        }
      }));
      insert(_el$13, createComponent(Show, {
        get when() {
          return info().trackList?.length;
        },
        get children() {
          var _el$14 = _tmpl$8(), _el$15 = _el$14.firstChild, _el$16 = _el$15.nextSibling;
          insert(_el$16, createComponent(For, {
            get each() {
              return info().trackList;
            },
            children: (track, index) => (() => {
              var _el$24 = _tmpl$14(), _el$25 = _el$24.firstChild;
              insert(_el$25, () => track.name);
              insert(_el$24, createComponent(Show, {
                get when() {
                  return track.contributionTags?.length;
                },
                get children() {
                  var _el$26 = _tmpl$13();
                  insert(_el$26, createComponent(For, {
                    get each() {
                      return track.contributionTags;
                    },
                    children: (tag) => (() => {
                      var _el$27 = _tmpl$12();
                      setAttribute(_el$27, "data-tag", tag);
                      insert(_el$27, tag);
                      return _el$27;
                    })()
                  }));
                  return _el$26;
                }
              }), null);
              return _el$24;
            })()
          }));
          return _el$14;
        }
      }), null);
      insert(_el$13, createComponent(Show, {
        get when() {
          return info().trackList?.length;
        },
        get children() {
          return _tmpl$9();
        }
      }), null);
      insert(_el$13, createComponent(Show, {
        get when() {
          return info().collaborators?.length || info().releasedBy?.length;
        },
        get children() {
          var _el$18 = _tmpl$10();
          insert(_el$18, createComponent(Show, {
            get when() {
              return info().collaborators?.length;
            },
            get children() {
              var _el$19 = _tmpl$0();
              _el$19.firstChild;
              insert(_el$19, createComponent(For, {
                get each() {
                  return info().collaborators;
                },
                children: (collaborator, index) => [(() => {
                  var _el$28 = _tmpl$15();
                  insert(_el$28, collaborator);
                  return _el$28;
                })(), createComponent(Show, {
                  get when() {
                    return index() < info().collaborators.length - 1;
                  },
                  children: ", "
                })]
              }), null);
              return _el$19;
            }
          }), null);
          insert(_el$18, createComponent(Show, {
            get when() {
              return info().releasedBy?.length;
            },
            get children() {
              var _el$21 = _tmpl$1();
              _el$21.firstChild;
              insert(_el$21, createComponent(For, {
                get each() {
                  return info().releasedBy;
                },
                children: (publisher) => createComponent(Show, {
                  get when() {
                    return info().releasedByLink;
                  },
                  get fallback() {
                    return (() => {
                      var _el$30 = _tmpl$16();
                      insert(_el$30, publisher);
                      return _el$30;
                    })();
                  },
                  get children() {
                    var _el$29 = _tmpl$7();
                    insert(_el$29, publisher);
                    createRenderEffect(() => setAttribute(_el$29, "href", info().releasedByLink));
                    return _el$29;
                  }
                })
              }), null);
              return _el$21;
            }
          }), null);
          return _el$18;
        }
      }), null);
      return _el$;
    })()
  });
}
var _tmpl$$1 = /* @__PURE__ */ template(`<div class=image-info-container><div class=image-area>`), _tmpl$2$1 = /* @__PURE__ */ template(`<div class=stage>`), _tmpl$3 = /* @__PURE__ */ template(`<img>`);
function getTrailElsIndex(cordHistValue) {
  return cordHistValue.map((el) => el.i);
}
function getTrailCurrentElsIndex(cordHistValue, stateValue) {
  return getTrailElsIndex(cordHistValue).slice(-stateValue.trailLength);
}
function getTrailInactiveElsIndex(cordHistValue, stateValue) {
  return getTrailCurrentElsIndex(cordHistValue, stateValue).slice(0, -1);
}
function getCurrentElIndex(cordHistValue) {
  return getTrailElsIndex(cordHistValue).slice(-1)[0];
}
function getPrevElIndex(cordHistValue, stateValue) {
  return decrement(cordHistValue.slice(-1)[0].i, stateValue.length);
}
function getNextElIndex(cordHistValue, stateValue) {
  return increment(cordHistValue.slice(-1)[0].i, stateValue.length);
}
function getImagesFromIndexes(imgs, indexes) {
  return indexes.map((i) => imgs[i]);
}
function hires(imgs) {
  imgs.forEach((img) => {
    if (img.src === img.dataset.hiUrl) return;
    img.src = img.dataset.hiUrl;
    img.height = parseInt(img.dataset.hiImgH);
    img.width = parseInt(img.dataset.hiImgW);
  });
}
function lores(imgs) {
  imgs.forEach((img) => {
    if (img.src === img.dataset.loUrl) return;
    img.src = img.dataset.loUrl;
    img.height = parseInt(img.dataset.loImgH);
    img.width = parseInt(img.dataset.loImgW);
  });
}
function onMutation(element, trigger, observeOptions = {
  attributes: true
}) {
  new MutationObserver((mutations, observer) => {
    for (const mutation of mutations) {
      if (trigger(mutation)) {
        observer.disconnect();
        break;
      }
    }
  }).observe(element, observeOptions);
}
function remToPx(remValue) {
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return remValue * rootFontSize;
}
function getImageTargetTransform() {
  const viewportWidth = window.innerWidth;
  const navHeight = remToPx(parseInt(getComputedStyle(document.documentElement).getPropertyValue("--nav-height")));
  const viewportHeight = window.innerHeight - navHeight;
  const panelMaxWidth = remToPx(parseInt(getComputedStyle(document.documentElement).getPropertyValue("--panel-max-width"))) || 401;
  const panelGapMax = remToPx(parseInt(getComputedStyle(document.documentElement).getPropertyValue("--panel-gap-max")) || 1);
  const imageAreaMaxHeight = viewportWidth - panelMaxWidth - panelGapMax;
  const imageAreaHeight = Math.min(imageAreaMaxHeight, viewportHeight);
  const imageAreaWidth = imageAreaHeight;
  const imageAreaLeft = 0;
  const imageAreaCenterX = imageAreaLeft + imageAreaWidth / 2;
  const viewportCenterX = viewportWidth / 2;
  const x = imageAreaCenterX - viewportCenterX;
  console.log("targetimagetransform-values", {
    panelMaxWidth,
    panelGapMax
  });
  const scale = imageAreaHeight / viewportHeight;
  console.log("Calculated transform:", {
    x,
    scale,
    imageAreaHeight,
    imageAreaWidth,
    imageAreaMaxHeight
  });
  return {
    x,
    scale
  };
}
function Stage(props) {
  let _gsap;
  const imgs = Array(props.ijs.length);
  let last = {
    x: 0,
    y: 0
  };
  let abortController;
  let gsapLoaded = false;
  const [state, {
    incIndex
  }] = useState();
  const stateLength = state().length;
  let mounted = false;
  const onMouse = (e) => {
    if (props.isOpen() || props.isAnimating() || !gsapLoaded || !mounted) return;
    const cord = {
      x: e.clientX,
      y: e.clientY
    };
    const travelDist = Math.hypot(cord.x - last.x, cord.y - last.y);
    if (travelDist > state().threshold) {
      last = cord;
      incIndex();
      const _state = state();
      const newHist = {
        i: _state.index,
        ...cord
      };
      props.setCordHist((prev) => [...prev, newHist].slice(-stateLength));
    }
  };
  const onClick = () => {
    if (!props.isAnimating()) props.setIsOpen(true);
  };
  const setPosition = () => {
    if (!mounted) return;
    if (imgs.length === 0) return;
    const _cordHist = props.cordHist();
    const trailElsIndex = getTrailElsIndex(_cordHist);
    if (trailElsIndex.length === 0) return;
    const elsTrail = getImagesFromIndexes(imgs, trailElsIndex);
    const _isOpen = props.isOpen();
    const _state = state();
    if (props.mode === "trail") _gsap.set(elsTrail, {
      x: (i) => _cordHist[i].x - window.innerWidth / 2,
      y: (i) => _cordHist[i].y - window.innerHeight / 2,
      opacity: (i) => Math.max((i + 1 + _state.trailLength <= _cordHist.length ? 0 : 1) - (_isOpen ? 1 : 0), 0),
      zIndex: (i) => i,
      scale: 0.6
    });
    if (_isOpen) {
      const currentIndex = getCurrentElIndex(_cordHist);
      const elc = imgs[currentIndex];
      const indexArrayToHires = [];
      const indexArrayToCleanup = [];
      switch (props.navVector()) {
        case "prev":
          indexArrayToHires.push(getPrevElIndex(_cordHist, _state));
          indexArrayToCleanup.push(getNextElIndex(_cordHist, _state));
          break;
        case "next":
          indexArrayToHires.push(getNextElIndex(_cordHist, _state));
          indexArrayToCleanup.push(getPrevElIndex(_cordHist, _state));
          break;
      }
      hires(getImagesFromIndexes(imgs, indexArrayToHires));
      _gsap.set(getImagesFromIndexes(imgs, indexArrayToCleanup), {
        opacity: 0
      });
      if (props.mode === "expanded-with-info") {
        console.log("exapndedewithinfoCEHCK");
        const {
          x,
          scale
        } = getImageTargetTransform();
        console.time("expand-animation");
        _gsap.set(elc, {
          x,
          y: 0,
          scale
        });
      } else {
        _gsap.set(elc, {
          x: 0,
          y: 0,
          scale: 1
        });
      }
      setLoaderForHiresImage(elc);
    } else {
      lores(elsTrail);
    }
  };
  const expandImage = async () => {
    if (!mounted || !gsapLoaded) throw new Error("not mounted or gsap not loaded");
    props.setIsAnimating(true);
    const _cordHist = props.cordHist();
    const _state = state();
    const elcIndex = getCurrentElIndex(_cordHist);
    const elc = imgs[elcIndex];
    const hasInfo = !!props.currentImageInfo();
    const infoTransform = hasInfo ? getImageTargetTransform() : {
      x: 0,
      scale: 1
    };
    if (props.currentImageInfo()) {
      console.log("current has image info");
      getImageTargetTransform();
    }
    hires(getImagesFromIndexes(imgs, [elcIndex, getPrevElIndex(_cordHist, _state), getNextElIndex(_cordHist, _state)]));
    setLoaderForHiresImage(elc);
    const tl = _gsap.timeline();
    const trailInactiveEls = getImagesFromIndexes(imgs, getTrailInactiveElsIndex(_cordHist, _state));
    tl.to(trailInactiveEls, {
      y: "+=20",
      ease: "power3.in",
      stagger: 0.075,
      duration: 0.3,
      delay: 0.1,
      opacity: 0
    });
    tl.to(elc, {
      y: 0,
      x: 0,
      ease: "power3.inOut",
      duration: 0.7,
      delay: 0.3
    });
    tl.to(elc, {
      delay: 0.1,
      scale: 1,
      ease: "power3.inOut"
    });
    if (hasInfo) {
      tl.to(elc, {
        delay: 0,
        transformOrigin: "left-center",
        scale: infoTransform.scale,
        x: infoTransform.x
      });
    }
    return await tl.then(() => {
      props.setIsAnimating(false);
    });
  };
  const minimizeImage = async () => {
    if (!mounted || !gsapLoaded) throw new Error("not mounted or gsap not loaded");
    props.setIsAnimating(true);
    props.setNavVector("none");
    const _cordHist = props.cordHist();
    const _state = state();
    const elcIndex = getCurrentElIndex(_cordHist);
    const elsTrailInactiveIndexes = getTrailInactiveElsIndex(_cordHist, _state);
    lores(getImagesFromIndexes(imgs, [...elsTrailInactiveIndexes, elcIndex]));
    const tl = _gsap.timeline();
    const elc = getImagesFromIndexes(imgs, [elcIndex])[0];
    const elsTrailInactive = getImagesFromIndexes(imgs, elsTrailInactiveIndexes);
    tl.to(elc, {
      scale: 0.6,
      duration: 0.6,
      ease: "power3.inOut"
    });
    tl.to(elc, {
      delay: 0.3,
      duration: 0.7,
      ease: "power3.inOut",
      x: _cordHist.slice(-1)[0].x - window.innerWidth / 2,
      y: _cordHist.slice(-1)[0].y - window.innerHeight / 2
    });
    tl.to(elsTrailInactive, {
      y: "-=20",
      ease: "power3.out",
      stagger: -0.1,
      duration: 0.3,
      opacity: 1
    });
    return await tl.then(() => {
      props.setIsAnimating(false);
    });
  };
  function setLoaderForHiresImage(img) {
    if (!mounted || !gsapLoaded) return;
    if (!img.complete) {
      props.setIsLoading(true);
      const controller = new AbortController();
      const abortSignal = controller.signal;
      img.addEventListener("load", () => {
        _gsap.to(img, {
          opacity: 1,
          ease: "power3.out",
          duration: 0.5
        }).then(() => {
          props.setIsLoading(false);
        }).catch((e) => {
          console.log(e);
        }).finally(() => {
          controller.abort();
        });
      }, {
        once: true,
        passive: true,
        signal: abortSignal
      });
      img.addEventListener("error", () => {
        _gsap.set(img, {
          opacity: 1
        }).then(() => {
          props.setIsLoading(false);
        }).catch((e) => {
          console.log(e);
        }).finally(() => {
          controller.abort();
        });
      }, {
        once: true,
        passive: true,
        signal: abortSignal
      });
    } else {
      _gsap.set(img, {
        opacity: 1
      }).then(() => {
        props.setIsLoading(false);
      }).catch((e) => {
        console.log(e);
      });
    }
  }
  onMount(() => {
    imgs.forEach((img, i) => {
      if (i < 5) {
        img.src = img.dataset.loUrl;
      }
      onMutation(img, (mutation) => {
        if (props.isOpen() || props.isAnimating()) return false;
        if (mutation.attributeName !== "style") return false;
        const opacity = parseFloat(img.style.opacity);
        if (opacity !== 1) return false;
        if (i + 5 < imgs.length) {
          imgs[i + 5].src = imgs[i + 5].dataset.loUrl;
        }
        return true;
      });
    });
    window.addEventListener("mousemove", () => {
      loadGsap().then((g) => {
        _gsap = g;
        gsapLoaded = true;
      }).catch((e) => {
        console.log(e);
      });
    }, {
      passive: true,
      once: true
    });
    abortController = new AbortController();
    const abortSignal = abortController.signal;
    window.addEventListener("mousemove", onMouse, {
      passive: true,
      signal: abortSignal
    });
    mounted = true;
  });
  createEffect(on(() => props.cordHist(), () => {
    setPosition();
  }, {
    defer: true
  }));
  createEffect(on(() => props.isOpen(), async () => {
    if (props.isAnimating()) return;
    if (props.isOpen()) {
      await expandImage().catch(() => {
      }).then(() => {
        abortController?.abort();
      });
    } else {
      await minimizeImage().catch(() => {
      }).then(() => {
        abortController = new AbortController();
        const abortSignal = abortController.signal;
        window.addEventListener("mousemove", onMouse, {
          passive: true,
          signal: abortSignal
        });
        props.setIsLoading(false);
      });
    }
  }, {
    defer: true
  }));
  return (() => {
    var _el$ = _tmpl$2$1();
    _el$.$$keydown = onClick;
    _el$.$$click = onClick;
    insert(_el$, createComponent(Show, {
      get when() {
        return props.mode === "expanded-with-info";
      },
      get children() {
        var _el$2 = _tmpl$$1();
        _el$2.firstChild;
        insert(_el$2, createComponent(ImageInfoPanel, {
          get info() {
            return props.currentImageInfo();
          }
        }), null);
        return _el$2;
      }
    }), null);
    insert(_el$, createComponent(For, {
      get each() {
        return props.ijs;
      },
      children: (ij, i) => (() => {
        var _el$4 = _tmpl$3();
        var _ref$ = imgs[i()];
        typeof _ref$ === "function" ? use(_ref$, _el$4) : imgs[i()] = _el$4;
        createRenderEffect((_p$) => {
          var _v$ = ij.loImgH, _v$2 = ij.loImgW, _v$3 = ij.hiUrl, _v$4 = ij.hiImgH, _v$5 = ij.hiImgW, _v$6 = ij.loUrl, _v$7 = ij.loImgH, _v$8 = ij.loImgW, _v$9 = ij.alt;
          _v$ !== _p$.e && setAttribute(_el$4, "height", _p$.e = _v$);
          _v$2 !== _p$.t && setAttribute(_el$4, "width", _p$.t = _v$2);
          _v$3 !== _p$.a && setAttribute(_el$4, "data-hi-url", _p$.a = _v$3);
          _v$4 !== _p$.o && setAttribute(_el$4, "data-hi-img-h", _p$.o = _v$4);
          _v$5 !== _p$.i && setAttribute(_el$4, "data-hi-img-w", _p$.i = _v$5);
          _v$6 !== _p$.n && setAttribute(_el$4, "data-lo-url", _p$.n = _v$6);
          _v$7 !== _p$.s && setAttribute(_el$4, "data-lo-img-h", _p$.s = _v$7);
          _v$8 !== _p$.h && setAttribute(_el$4, "data-lo-img-w", _p$.h = _v$8);
          _v$9 !== _p$.r && setAttribute(_el$4, "alt", _p$.r = _v$9);
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0,
          o: void 0,
          i: void 0,
          n: void 0,
          s: void 0,
          h: void 0,
          r: void 0
        });
        return _el$4;
      })()
    }), null);
    createRenderEffect((_$p) => classList(_el$, {
      [props.mode]: true
    }, _$p));
    return _el$;
  })();
}
delegateEvents(["click", "keydown"]);
var _tmpl$ = /* @__PURE__ */ template(`<div class=navOverlay>`), _tmpl$2 = /* @__PURE__ */ template(`<div class=overlay tabindex=-1>`);
function StageNav(props) {
  let controller;
  const navItems = [props.prevText, props.closeText, props.nextText];
  const [state, {
    incIndex,
    decIndex
  }] = useState();
  const stateLength = state().length;
  const prevImage = () => {
    props.setNavVector("prev");
    props.setCordHist((c) => c.map((item) => {
      return {
        ...item,
        i: decrement(item.i, stateLength)
      };
    }));
    decIndex();
  };
  const closeImage = () => {
    props.setIsOpen(false);
  };
  const nextImage = () => {
    props.setNavVector("next");
    props.setCordHist((c) => c.map((item) => {
      return {
        ...item,
        i: increment(item.i, stateLength)
      };
    }));
    incIndex();
  };
  const handleClick = (item) => {
    if (!props.isOpen() || props.isAnimating()) return;
    if (item === navItems[0]) prevImage();
    else if (item === navItems[1]) closeImage();
    else nextImage();
  };
  const handleKey = (e) => {
    if (!props.isOpen() || props.isAnimating()) return;
    if (e.key === "ArrowLeft") prevImage();
    else if (e.key === "Escape") closeImage();
    else if (e.key === "ArrowRight") nextImage();
  };
  createEffect(() => {
    if (props.isOpen()) {
      controller = new AbortController();
      const abortSignal = controller.signal;
      window.addEventListener("keydown", handleKey, {
        passive: true,
        signal: abortSignal
      });
    } else {
      controller?.abort();
    }
  });
  return (() => {
    var _el$ = _tmpl$();
    insert(_el$, createComponent(For, {
      each: navItems,
      children: (item) => (() => {
        var _el$2 = _tmpl$2();
        _el$2.$$mouseover = () => props.setHoverText(item);
        _el$2.addEventListener("focus", () => props.setHoverText(item));
        _el$2.$$click = () => {
          handleClick(item);
        };
        return _el$2;
      })()
    }));
    createRenderEffect(() => _el$.classList.toggle("active", !!props.active()));
    return _el$;
  })();
}
delegateEvents(["click", "mouseover"]);
function Desktop(props) {
  const [cordHist, setCordHist] = createSignal([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isOpen, setIsOpen] = createSignal(false);
  const [isAnimating, setIsAnimating] = createSignal(false);
  const [hoverText, setHoverText] = createSignal("");
  const [navVector, setNavVector] = createSignal("none");
  const active = createMemo(() => isOpen() && !isAnimating());
  const cursorText = createMemo(() => isLoading() ? props.loadingText : hoverText());
  const currentImage = createMemo(() => {
    if (!isOpen()) return null;
    const history = cordHist();
    if (!history.length) return null;
    const currentIndex = history[history.length - 1].i;
    return props.ijs[currentIndex];
  });
  const currentImageInfo = createMemo(() => {
    const img = currentImage();
    return img?.imageInfo;
  });
  createMemo(() => currentImage()?.imageInfo !== void 0);
  const viewPortMode = createMemo(() => {
    if (!isOpen()) return "trail";
    if (currentImageInfo() && isOpen() && isAnimating()) {
      return "animating-with-info";
    }
    if (currentImageInfo() && isOpen() && !isAnimating()) return "expanded-with-info";
    return "expanded";
  });
  return [createComponent(Nav, {}), createComponent(Show, {
    get when() {
      return props.ijs.length > 0;
    },
    get children() {
      return [createComponent(Stage, {
        get ijs() {
          return props.ijs;
        },
        setIsLoading,
        isOpen,
        setIsOpen,
        isAnimating,
        setIsAnimating,
        cordHist,
        setCordHist,
        navVector,
        setNavVector,
        get mode() {
          return viewPortMode();
        },
        currentImageInfo
      }), createComponent(CustomCursor, {
        cursorText,
        active,
        isOpen
      }), createComponent(StageNav, {
        get prevText() {
          return props.prevText;
        },
        get closeText() {
          return props.closeText;
        },
        get nextText() {
          return props.nextText;
        },
        get loadingText() {
          return props.loadingText;
        },
        active,
        isAnimating,
        setCordHist,
        isOpen,
        setIsOpen,
        setHoverText,
        navVector,
        setNavVector
      })];
    }
  })];
}
export {
  Desktop as default
};
