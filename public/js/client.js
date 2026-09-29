let totalClients = document.querySelector("#clients-total");
let messageContainer = document.querySelector("#message-container");
let nameInput = document.querySelector("#name-input");
let messageForm = document.querySelector("#message-form");
let messageInput = document.querySelector("#message-input");
let fileInput = document.querySelector("#file-input");
let uploadBtn = document.querySelector("#upload-btn");
let feedback = document.querySelector("#feedback");

let messageTone = new Audio("/audio/message-tone.mp3");
let greetingAudio = new Audio("/audio/greeting.mp3");
let toast = document.querySelector("#toast");
let toastTimeout;
let hasConnected = false;

localStorage.removeItem("chatzyx-target-language");

function playGreeting() {
  const storageKey = "chatzyx-greeting-played";
  const greetingPlayed = localStorage.getItem(storageKey) === "true";
  if (greetingPlayed) return;
  localStorage.setItem(storageKey, "false");

  let playbackPending = false;

  const playAfterInteraction = () => {
    if (playbackPending) return;
    playbackPending = true;

    greetingAudio
      .play()
      .then(() => {
        localStorage.setItem(storageKey, "true");
        document.removeEventListener("pointerdown", playAfterInteraction);
        document.removeEventListener("keydown", playAfterInteraction);
      })
      .catch(() => {})
      .finally(() => {
        playbackPending = false;
      });
  };

  greetingAudio.play().then(
    () => localStorage.setItem(storageKey, "true"),
    () => {
      document.addEventListener("pointerdown", playAfterInteraction);
      document.addEventListener("keydown", playAfterInteraction);
    },
  );
}

playGreeting();

if (
  window.matchMedia("(pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 5;
  let currentX = targetX;
  let currentY = targetY;
  let animationFrame = null;

  document.body.style.setProperty("--ambient-x", `${currentX}px`);
  document.body.style.setProperty("--ambient-y", `${currentY}px`);

  function followPointer() {
    currentX += (targetX - currentX) * 0.14;
    currentY += (targetY - currentY) * 0.14;
    document.body.style.setProperty("--ambient-x", `${currentX}px`);
    document.body.style.setProperty("--ambient-y", `${currentY}px`);

    if (
      Math.abs(targetX - currentX) > 0.5 ||
      Math.abs(targetY - currentY) > 0.5
    ) {
      animationFrame = requestAnimationFrame(followPointer);
    } else {
      currentX = targetX;
      currentY = targetY;
      document.body.style.setProperty("--ambient-x", `${currentX}px`);
      document.body.style.setProperty("--ambient-y", `${currentY}px`);
      animationFrame = null;
    }
  }

  document.addEventListener(
    "pointermove",
    (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
      if (animationFrame === null) {
        animationFrame = requestAnimationFrame(followPointer);
      }
    },
    { passive: true },
  );
}

// Chat Container Fade-In Animation
gsap.to("#chat-container", {
  opacity: 1,
  duration: 1,
  ease: "power2.out",
});

// Send Button Scale Animation on Hover
document.querySelector(".send-btn").addEventListener("mouseenter", function () {
  gsap.to(".send-btn", { scale: 1.03, duration: 0.2 });
});

document.querySelector(".send-btn").addEventListener("mouseleave", function () {
  gsap.to(".send-btn", { scale: 1, duration: 0.2 });
});

let socket = io();
let username = nameInput.value;

socket.on("connect", () => {
  if (hasConnected) {
    showToast("Connection restored.", "success");
  }
  hasConnected = true;
});

socket.on("disconnect", () => {
  if (hasConnected) {
    showToast("Connection lost. Trying to reconnect.");
  }
});

socket.on("connect_error", () => {
  showToast("Unable to connect. Check your internet connection and try again.");
});

// Emit username to server when changed
nameInput.addEventListener("input", () => {
  username = nameInput.value || "anonymous";
  socket.emit("set-username", username);
});

messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (messageInput.value.trim().length > 0) {
    sendMessage();
  }
});

// Send message
function sendMessage() {
  if (!socket.connected) {
    showToast("You are offline. Your message has not been sent.");
    return;
  }

  let data = {
    name: username,
    message: messageInput.value.trim(),
    date: new Date().toISOString(),
  };
  socket.emit("message", data);
  addMessageToUI(true, data, "bg-blue-500");
  messageInput.value = "";
}

// Other clients message
socket.on("chat-message", (data) => {
  addMessageToUI(false, data, "bg-gray-700");
  messageTone.play();
});

// Handle Chat UI
function addMessageToUI(isOwnMessage, data, colorCode) {
  clearFeedback();
  let element = "";

  if (data.fileUrl) {
    if (data.fileType.includes("image")) {
      element = `<div class="flex items-start space-x-2 ${isOwnMessage ? "message-right" : "message-left"}">
        <div class="${colorCode} text-white px-4 py-2 rounded-xl max-w-[75%]">
          <p>${data.message}</p>
          <img src="${data.fileUrl}" alt="Image" class="max-w-full rounded-xl mt-2 cursor-pointer" onclick="downloadFile('${data.fileUrl}')">
          <span class="text-xs opacity-75" id="message-time-${data.date}">
            ${data.name} • ${moment(data.date).format("h:mm A")}
          </span>
        </div>
      </div>`;
    } else if (data.fileType.includes("video")) {
      element = `<div class="flex items-start space-x-2 ${isOwnMessage ? "message-right" : "message-left"}">
        <div class="${colorCode} text-white px-4 py-2 rounded-xl max-w-[75%]">
          <p>${data.message}</p>
          <video controls class="max-w-full rounded-xl mt-2">
            <source src="${data.fileUrl}" type="${data.fileType}">
            Your browser does not support the video tag.
          </video>
          <span class="text-xs opacity-75" id="message-time-${data.date}">
            ${data.name} • ${moment(data.date).format("h:mm A")}
          </span>
        </div>
      </div>`;
    } else if (data.fileType.includes("pdf")) {
      element = `<div class="flex items-start space-x-2 ${isOwnMessage ? "message-right" : "message-left"}">
        <div class="${colorCode} text-white px-4 py-2 rounded-xl max-w-[75%]">
          <p>${data.message}</p>
          <iframe src="${data.fileUrl}" class="w-full h-72 mt-2 rounded-xl" frameborder="0"></iframe>
          <span class="text-xs opacity-75" id="message-time-${data.date}">
            ${data.name} • ${moment(data.date).format("h:mm A")}
          </span>
        </div>
      </div>`;
    }
  } else {
    element = `<div class="flex items-start space-x-2 ${isOwnMessage ? "message-right" : "message-left"}">
      <div class="${colorCode} text-white px-4 py-2 rounded-xl max-w-[75%]">
        <p>${data.message}</p>
        <span class="text-xs opacity-75" id="message-time-${data.date}">
          ${data.name} • ${moment(data.date).format("h:mm A")}
        </span>
      </div>
    </div>`;
  }

  messageContainer.innerHTML += element;
  scrollToBottom();
}

// It will make the UI scroll to bottom itself
function scrollToBottom() {
  messageContainer.scrollTo({
    top: messageContainer.scrollHeight,
    behavior: "smooth",
  });
}

// User focus on input
messageInput.addEventListener("focus", () => {
  socket.emit("feedback", {
    feedback: `✒️ ${username} is typing a message`,
  });
});

// User is typing
messageInput.addEventListener("keypress", () => {
  socket.emit("feedback", {
    feedback: `✒️ ${username} is typing a message`,
  });
});

// User is not typing/focus
messageInput.addEventListener("blur", () => {
  clearFeedback();
  socket.emit("feedback", {
    feedback: "",
  });
});

// Handling total clients
socket.on("clients-total", (data) => {
  totalClients.textContent = `${data} online`;
});

// If typing then show
socket.on("feedback", (data) => {
  if (!data || !data.feedback || !data.feedback.trim()) {
    clearFeedback();
    return;
  }

  clearFeedback();
  let feedback = `<div class="text-sm text-gray-400 italic message" id="feedback">${data.feedback}</div>`;
  messageContainer.innerHTML += feedback;
});

// Clear the typing feedback
function clearFeedback() {
  document.querySelectorAll("#feedback").forEach((element) => {
    element.parentNode.removeChild(element);
  });
}

// Handle user disconnect
socket.on("user-disconnected", (disconnectedUsername) => {
  showToast(`${disconnectedUsername} disconnected.`);
});

function showToast(message, type = "error") {
  clearTimeout(toastTimeout);
  gsap.killTweensOf(toast);

  const iconWrapper = document.createElement("span");
  iconWrapper.className = "toast-icon";
  iconWrapper.setAttribute("aria-hidden", "true");

  const icon = document.createElement("i");
  icon.className = `fas ${type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}`;
  iconWrapper.appendChild(icon);

  const messageElement = document.createElement("span");
  messageElement.textContent = message;
  toast.replaceChildren(iconWrapper, messageElement);
  toast.classList.toggle("toast-success", type === "success");
  toast.style.display = "flex";

  gsap.fromTo(
    toast,
    { opacity: 0, y: -8 },
    { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" },
  );

  toastTimeout = setTimeout(() => {
    gsap.to(toast, {
      opacity: 0,
      y: -8,
      duration: 0.25,
      ease: "power2.in",
      onComplete: () => {
        toast.style.display = "none";
      },
    });
  }, 3200);
}

// Open file input when the upload button is clicked
uploadBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", async function () {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);
  uploadBtn.disabled = true;

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      showToast(data.error || "Upload failed. Please try again.");
      return;
    }

    const fileData = {
      name: username,
      message: "",
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      date: new Date().toISOString(),
    };

    socket.emit("message", fileData);
    addMessageToUI(true, fileData, "bg-gray-700");
  } catch (error) {
    console.error("File upload failed:", error);
    showToast("Upload failed. Check your connection and try again.");
  } finally {
    uploadBtn.disabled = false;
    fileInput.value = "";
  }
});

// Download the file when the user clicks on image/video/audio/pdf
function downloadFile(fileUrl) {
  const link = document.createElement("a");
  link.href = fileUrl;
  link.download = fileUrl.split("/").pop();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
