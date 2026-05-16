// Function to inject the button next to an editable field
function injectGemmaButton(element) {
  if (element.dataset.gemmaInjected) return;
  element.dataset.gemmaInjected = "true";

  // Create an "Improve" button
  const improveBtn = document.createElement('button');
  improveBtn.innerText = 'Improve';
  improveBtn.className = 'gemma-btn-improve';
  improveBtn.type = 'button';

  // For Gmail/Rich text, appending it right after or inside a wrapper works best
  element.parentNode.insertBefore(improveBtn, element.nextSibling);

  improveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Handle both standard input values and Gmail's rich text innerText
    const isContentEditable = element.hasAttribute('contenteditable');
    const originalText = isContentEditable ? element.innerText.trim() : element.value.trim();
    
    if (!originalText) return alert("Please type something first!");

    // Remove existing floating popup if present
    const existingPopup = document.getElementById('gemma-floating-popup');
    if (existingPopup) existingPopup.remove();

    // Create the floating UI card
    const popup = document.createElement('div');
    popup.id = 'gemma-floating-popup';
    popup.className = 'gemma-popup-container';
    
    const rect = improveBtn.getBoundingClientRect();
    popup.style.top = `${window.scrollY + rect.bottom + 5}px`;
    popup.style.left = `${window.scrollX + rect.left}px`;

    popup.innerHTML = `
      <textarea class="gemma-popup-text" id="gemma-output-box" readonly>Thinking...</textarea>
      <div class="gemma-popup-actions">
        <button class="gemma-action-btn primary" id="gemma-copy-btn" disabled>Copy & Paste</button>
        <button class="gemma-action-btn" id="gemma-clear-btn">Cancel</button>
      </div>
    `;
    document.body.appendChild(popup);

    // Call local Gemma 4 E2B model via LM Studio
    fetch('http://localhost:8086/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "google/gemma-4-e2b",
        messages: [
          { 
            role: "system", 
            content: "You are a professional editor. Correct any grammatical mistakes, fix spelling errors, and subtly improve the flow of the user's text. Return ONLY the final corrected text. Do not provide explanations, introductory remarks, or markdown code blocks." 
          },
          { role: "user", content: originalText }
        ],
        temperature: 0.3
      })
    })
    .then(res => res.json())
    .then(data => {
      const resultText = data.choices[0].message.content.trim();
      const outputBox = document.getElementById('gemma-output-box');
      const copyBtn = document.getElementById('gemma-copy-btn');
      
      outputBox.value = resultText;
      copyBtn.disabled = false;

      // Handle Copy & Paste replacement
      copyBtn.onclick = () => {
        if (isContentEditable) {
          element.innerText = resultText; // For Gmail body
          // Trigger an input event so Gmail registers that the text changed
          element.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          element.value = resultText; // For standard inputs
        }
        popup.remove();
      };
    })
    .catch(err => {
      document.getElementById('gemma-output-box').value = "Error connecting to local Gemma model. Make sure LM studio is running on port 8086 with CORS enabled!";
      console.error(err);
    });

    document.getElementById('gemma-clear-btn').onclick = () => popup.remove();
  });
}

// Scan function looking for standard fields AND contenteditable boxes
function scanForInputFields() {
  const targetSelectors = 'textarea, input[type="text"], [contenteditable="true"]';
  document.querySelectorAll(targetSelectors).forEach(field => {
    // Avoid injecting on Gmail's hidden utility elements or search bars unless desired
    if (field.tagName === 'DIV' && !field.classList.contains('Am')) {
      // Custom guard: Gmail's body always carries the class 'Am' or 'editable'
      if (!field.classList.contains('editable') && !field.getAttribute('aria-label')?.includes('Message Body')) {
         return; 
      }
    }
    injectGemmaButton(field);
  });
}

// Running an initial scan when the script fires up
scanForInputFields();

// The magic sauce: Watch Gmail dynamically generate content boxes
const observer = new MutationObserver((mutations) => {
  scanForInputFields();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});