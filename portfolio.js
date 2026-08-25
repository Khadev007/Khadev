const menuButton = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const contactForm = document.querySelector(".contact-form");
const formMessage = document.querySelector(".form-message");

// Always use dark mode
document.body.classList.add("dark");

// Mobile menu
menuButton?.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");

    menuButton.setAttribute("aria-expanded", isOpen);
    menuButton.textContent = isOpen ? "✕" : "☰";
});

document.querySelectorAll(".nav-links a").forEach(link => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        menuButton.textContent = "☰";
        menuButton.setAttribute("aria-expanded", "false");
    });
});

// Project filtering
document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelector(".filter.active")?.classList.remove("active");
        button.classList.add("active");

        const selectedCategory = button.dataset.filter;

        document.querySelectorAll(".project-card").forEach(project => {
            project.style.display =
                selectedCategory === "all" ||
                project.dataset.category === selectedCategory
                    ? "block"
                    : "none";
        });
    });
});

// Scroll reveal animation
if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll(".reveal").forEach(element => {
        revealObserver.observe(element);
    });
}

// Contact form
contactForm?.addEventListener("submit", event => {
    event.preventDefault();

    const name = contactForm.querySelector('[name="name"]').value.trim();

    formMessage.textContent =
        `Thank you, ${name}! Your message has been received.`;

    contactForm.reset();
});