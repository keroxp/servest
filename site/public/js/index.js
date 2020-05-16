document.addEventListener("DOMContentLoaded", () => {
  const navButton = document.querySelector(".navButton");
  const sideBar = document.querySelector(".sideBar");
  let sideBarOpen = false;
  navButton.addEventListener("click", () => {
    if (sideBarOpen) {
      sideBar.style.visibility = "hidden";
    } else {
      sideBar.style.visibility = "visible";
    }
    sideBarOpen = !sideBarOpen;
  });
});
