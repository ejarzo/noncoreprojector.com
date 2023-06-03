function toggle(element, first, second){
  if(element.classList.contains(first)){
     element.classList.remove(first);
     element.classList.add(second);
  } else {
    element.classList.remove(second);
    element.classList.add(first)
  }
}

(function () {
  const navButton = document.querySelector('.main-btn-nav');
  const closeNavButton = document.querySelector('.close-btn-nav');
  const navContent = document.querySelector('.nav-content');
  const takeoverContentButton = document.querySelector('.nav .btn-nav');
  const takeoverContent = document.querySelector('.takeover-content');

  navButton.addEventListener("click", function (e) {
    e.preventDefault();
    takeoverContent.classList.remove('showNav');
    takeoverContent.classList.add('hideNav');
    toggle(navContent, 'showNav', 'hideNav');
    navContent.classList.remove('hidden');
    this.classList.toggle('animated');
  });

  closeNavButton.addEventListener("click", function (e) { 
    e.preventDefault();
    toggle(navContent, 'hideNav', 'showNav');
    this.classList.toggle('animated');
  });

  takeoverContentButton.addEventListener("click", function (e) {
    e.preventDefault();
    navContent.classList.remove('showNav');
    navContent.classList.add('hideNav');
    toggle(takeoverContent, 'showNav', 'hideNav');
    takeoverContent.classList.remove('hidden');
    this.classList.toggle('animated');
    let isPlus = this.innerText === '[?]';
    this.innerText = isPlus ? '[x]' : '[?]';
  });
})();