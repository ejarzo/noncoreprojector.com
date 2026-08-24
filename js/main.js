// Nav overlay toggle. The "NonCore Projector" label and the [?] button both
// open/close the info nav; [close] closes it. (The old Vec Tor Bel takeover
// panel was removed, so this no longer references .takeover-content.)
(function () {
  const navContent = document.querySelector('.nav-content');
  const infoButton = document.querySelector('.nav .btn-nav');   // [?]
  const navButton = document.querySelector('.main-btn-nav');    // "NonCore Projector"
  const closeNavButton = document.querySelector('.close-btn-nav');

  function isOpen() {
    return !!navContent && navContent.classList.contains('showNav');
  }

  function setOpen(open) {
    if (!navContent) return;
    navContent.classList.remove('hidden');
    navContent.classList.toggle('showNav', open);
    navContent.classList.toggle('hideNav', !open);
    if (infoButton) infoButton.innerText = open ? '[x]' : '[?]';
  }

  [navButton, infoButton].forEach(function (btn) {
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      setOpen(!isOpen());
      this.classList.toggle('animated');
    });
  });

  if (closeNavButton) {
    closeNavButton.addEventListener('click', function (e) {
      e.preventDefault();
      setOpen(false);
    });
  }

  /**
     * Inserts a single space into the given string at a random position.
     * The space is inserted somewhere between the first and last character.
     *
     * @param {string} str - The original string.
     * @returns {string} The string with one randomly inserted space.
     */
    function insertOneSpace(str) {
      // Choose a random position between 1 and (str.length - 1)
      const pos = Math.floor(Math.random() * (str.length - 1)) + 1;
      return str.slice(0, pos) + " " + str.slice(pos);
    }

    /**
     * Updates the display element with the new string.
     */
    function updateDisplay() {
      const baseString = "NonCoreProjector";
      const spacedString = insertOneSpace(baseString);
      document.getElementById("display").textContent = spacedString;
    }

    updateDisplay();
    setInterval(updateDisplay, 3000); // Update the display every 3 seconds
})();
