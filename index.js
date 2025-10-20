import { GoogleGenAI } from "@google/genai";

// --- CONSTANTS ---
const STYLE_MODIFIERS = {
    'none': '',
    'photographic': ', hyper-realistic photograph',
    'cinematic': ', cinematic film still, dramatic lighting',
    'anime': ', vibrant anime style, detailed illustration',
    'digital-art': ', epic digital painting, concept art, matte painting',
    'fantasy': ', epic fantasy art, magical, otherworldly',
    'low-poly': ', low-poly isometric 3D render',
    'watercolor': ', a delicate watercolor painting',
    'pixel-art': ', 8-bit pixel art',
    'isometric': ', an isometric 3D illustration',
    'line-art': ', clean black and white line art',
    'sticker': ', a cute die-cut sticker illustration',
};


const SPINNER_SVG = `<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

// --- GEMINI SERVICE ---
class GeminiService {
  ai;

  constructor(apiKey) {
    if (!apiKey) {
      console.error("API key is missing. The app will not function correctly.");
      throw new Error("API key is not configured. Please set the API_KEY environment variable.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateImages(options) {
    const { prompt, numberOfImages, aspectRatio, stylePreset } = options;
    try {
        const modifier = STYLE_MODIFIERS[stylePreset ?? 'none'] || '';
        const finalPrompt = `${prompt.trim()}${modifier}`;
        
        const modelToUse = 'imagen-4.0-generate-001';

        const config = {
          numberOfImages,
          outputMimeType: 'image/jpeg',
          aspectRatio,
        };

        const response = await this.ai.models.generateImages({
            model: modelToUse,
            prompt: finalPrompt,
            config: config,
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
            // Let the catch block handle this to unify error messaging.
            throw new Error("No images were returned by the API.");
        }

        return response.generatedImages.map(img => img.image.imageBytes);
    } catch (error) {
        console.error("Error generating images:", error);
        // A consolidated, more neutral error message.
        throw new Error("Image generation failed. This can happen due to safety filters or a restrictive prompt. Please try again with a modified prompt.");
    }
  }

  async improvePrompt(prompt) {
    if (!prompt.trim()) return '';
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Refine this image generation prompt to be more vivid, descriptive, and imaginative. Return only the improved prompt text, without any introductory phrases like "Here's the improved prompt:":\n\n${prompt}`,
        config: { thinkingConfig: { thinkingBudget: 0 } }
      });
      return response.text.trim().replace(/^"|"$/g, '');
    } catch (error) {
      console.error("Error improving prompt:", error);
      throw new Error("Failed to get prompt suggestion.");
    }
  }

  async getRandomPrompt() {
    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Generate a single, random, highly-detailed and creative prompt for an image generation AI. Focus on a unique subject, setting, and style. Return only the prompt text.",
            config: {
                temperature: 1.2, topP: 0.98, topK: 40,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return response.text.trim().replace(/^"|"$/g, '');
    } catch (error) {
        console.error("Error getting random prompt:", error);
        throw new Error("Failed to get a random prompt.");
    }
  }

  async describeImage(base64, mimeType) {
    try {
      const imagePart = { inlineData: { data: base64, mimeType } };
      const textPart = { text: "Describe this image in detail. Create a rich, descriptive prompt that could be used to recreate this image with an AI image generator." };
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] }
      });
      return response.text;
    } catch (error) {
      console.error("Error describing image:", error);
      throw new Error("Failed to describe the image.");
    }
  }
}

let geminiService;
const isApiKeyMissing = !process.env.API_KEY;
try {
    geminiService = new GeminiService(process.env.API_KEY);
} catch (e) {
    console.error(e);
    geminiService = {
        generateImages: () => Promise.reject(new Error("API Key not configured")),
        improvePrompt: () => Promise.reject(new Error("API Key not configured")),
        getRandomPrompt: () => Promise.reject(new Error("API Key not configured")),
        describeImage: () => Promise.reject(new Error("API Key not configured")),
    };
}


// --- DOM ELEMENTS ---
const DOMElements = {
    // Banners
    noticeBanner: document.getElementById('notice-banner'),
    dismissNoticeButton: document.getElementById('dismiss-notice-button'),
    apiKeyBanner: document.getElementById('api-key-banner'),
    // Main components
    settingsPanel: document.getElementById('settings-panel'),
    imageGalleryContainer: document.getElementById('image-gallery-container'),
    // Side Menu
    sideMenu: document.getElementById('side-menu'),
    sideMenuOverlay: document.getElementById('side-menu-overlay'),
    openMenuButton: document.getElementById('open-menu-button'),
    closeMenuButton: document.getElementById('close-menu-button'),
    historyList: document.getElementById('history-list'),
    clearHistoryButton: document.getElementById('clear-history-button'),
    // Settings: Prompt
    promptInput: document.getElementById('prompt-input'),
    improvePromptButton: document.getElementById('improve-prompt-button'),
    randomPromptButton: document.getElementById('random-prompt-button'),
    describeImageButton: document.getElementById('describe-image-button'),
    // Settings: Aspect Ratio
    aspectRatioSelector: document.getElementById('aspect-ratio-selector'),
    // Settings: Image Count
    imageCountSelector: document.getElementById('image-count-selector'),
    // Settings: Advanced
    negativePromptInput: document.getElementById('negative-prompt-input'),
    seedInput: document.getElementById('seed-input'),
    randomSeedButton: document.getElementById('random-seed-button'),
    stylePresetSelector: document.getElementById('style-preset-selector'),
    imageReferenceUploadButton: document.getElementById('image-reference-upload-button'),
    imageReferenceInput: document.getElementById('image-reference-input'),
    imageReferencePreview: document.getElementById('image-reference-preview'),
    imageReferencePlaceholder: document.getElementById('image-reference-placeholder'),
    imageReferenceRemoveButton: document.getElementById('image-reference-remove-button'),
    // Settings: Generate Button
    generateButton: document.getElementById('generate-button'),
    generateButtonText: document.getElementById('generate-button-text'),
    // Feedback form
    feedbackForm: document.getElementById('feedback-form'),
    feedbackInput: document.getElementById('feedback-input'),
    feedbackSubmit: document.getElementById('feedback-submit'),
    feedbackSuccess: document.getElementById('feedback-success'),
};

// Store original button content for loading states
const originalButtonContent = {};

// --- APP STATE ---
let state = {
    options: {
        prompt: '',
        aspectRatio: '1:1',
        numberOfImages: 1,
        stylePreset: 'none',
        referenceImage: null,
        negativePrompt: '',
        seed: '',
    },
    history: [],
    selectedHistoryId: null,
    isLoading: false,
    promptLoadingAction: null,
    error: null,
    isSideMenuOpen: false,
};

// --- RENDER FUNCTIONS ---
function renderAll() {
    renderSettings();
    renderImageGallery();
    renderHistory();
    renderSideMenu();
    updateGenerateButtonState();
    updatePromptActionButtons();
}

function renderSettings() {
    DOMElements.promptInput.value = state.options.prompt;
    DOMElements.negativePromptInput.value = state.options.negativePrompt;
    DOMElements.seedInput.value = state.options.seed;
    
    DOMElements.aspectRatioSelector.querySelectorAll('.aspect-ratio-button').forEach(btn => {
        const isSelected = btn.dataset.value === state.options.aspectRatio;
        btn.classList.toggle('bg-indigo-600/30', isSelected);
        btn.classList.toggle('border-indigo-500', isSelected);
        btn.classList.toggle('text-white', isSelected);
        btn.classList.toggle('bg-gray-700/50', !isSelected);
        btn.classList.toggle('border-gray-600', !isSelected);
        btn.classList.toggle('hover:bg-gray-600/50', !isSelected);
        btn.classList.toggle('text-gray-400', !isSelected);
    });
    
    DOMElements.imageCountSelector.querySelectorAll('.image-count-button').forEach(btn => {
        const isSelected = parseInt(btn.dataset.value) === state.options.numberOfImages;
        btn.classList.toggle('bg-indigo-600', isSelected);
        btn.classList.toggle('text-white', isSelected);
        btn.classList.toggle('ring-2', isSelected);
        btn.classList.toggle('ring-indigo-500', isSelected);
        btn.classList.toggle('ring-offset-2', isSelected);
        btn.classList.toggle('ring-offset-gray-800', isSelected);
        btn.classList.toggle('bg-gray-700', !isSelected);
        btn.classList.toggle('hover:bg-gray-600', !isSelected);
        btn.classList.toggle('text-gray-300', !isSelected);
    });

    DOMElements.stylePresetSelector.value = state.options.stylePreset;

    if (state.options.referenceImage) {
        DOMElements.imageReferencePreview.src = `data:${state.options.referenceImage.mimeType};base64,${state.options.referenceImage.base64}`;
        DOMElements.imageReferencePreview.classList.remove('hidden');
        DOMElements.imageReferencePlaceholder.classList.add('hidden');
        DOMElements.imageReferenceRemoveButton.classList.remove('hidden');
    } else {
        DOMElements.imageReferencePreview.classList.add('hidden');
        DOMElements.imageReferencePlaceholder.classList.remove('hidden');
        DOMElements.imageReferenceRemoveButton.classList.add('hidden');
    }
}

function renderImageGallery() {
    const container = DOMElements.imageGalleryContainer;
    container.innerHTML = ''; 

    if (state.isLoading) {
        const getGridCols = (count) => {
            if (count <= 1) return 'grid-cols-1';
            if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
            if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3';
            return 'grid-cols-1 sm:grid-cols-2';
        };
        const grid = document.createElement('div');
        grid.className = `grid ${getGridCols(state.options.numberOfImages)} gap-4`;
        for (let i = 0; i < state.options.numberOfImages; i++) {
            grid.innerHTML += `
                <div class="aspect-square bg-gray-800 rounded-lg flex items-center justify-center">
                    <svg class="animate-spin -ml-1 mr-3 h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>`;
        }
        container.appendChild(grid);
        return;
    }

    if (state.error) {
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center bg-gray-800/50 rounded-lg p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"></path></svg>
                <h3 class="text-xl font-bold text-white mb-2">Generation Failed</h3>
                <p class="text-gray-400 max-w-md">${state.error}</p>
            </div>`;
        return;
    }

    const generation = state.history.find(item => item.id === state.selectedHistoryId);
    if (generation && generation.images.length > 0) {
        const getGridCols = (count) => {
            if (count <= 1) return 'grid-cols-1';
            if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
            if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3';
            return 'grid-cols-1 sm:grid-cols-2';
        };
        const grid = document.createElement('div');
        grid.className = `grid ${getGridCols(generation.images.length)} gap-4`;
        
        generation.images.forEach((base64) => {
            const imageUrl = `data:image/jpeg;base64,${base64}`;
            const imageWrapper = document.createElement('div');
            imageWrapper.className = 'group relative bg-gray-800 rounded-lg overflow-hidden aspect-square';
            imageWrapper.innerHTML = `
                <img src="${imageUrl}" alt="${generation.options.prompt}" class="w-full h-full object-cover" />
                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center flex-wrap gap-2 p-2">
                    <button data-action="edit" class="flex items-center gap-2 bg-white/20 backdrop-blur-md text-white font-semibold py-2 px-3 rounded-lg hover:bg-white/30 transition-colors text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z"></path><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z"></path></svg>
                        Edit
                    </button>
                    <button data-action="download" class="flex items-center gap-2 bg-white/20 backdrop-blur-md text-white font-semibold py-2 px-3 rounded-lg hover:bg-white/30 transition-colors text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"></path></svg>
                        Download
                    </button>
                </div>
            `;
            grid.appendChild(imageWrapper);
        });
        container.appendChild(grid);
        return;
    }

    container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center bg-gray-800/50 rounded-lg p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-24 h-24 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"></path></svg>
            <h3 class="text-2xl font-bold text-white">Your creations appear here</h3>
            <p class="text-gray-400 mt-2">Enter a prompt and click "Generate" to see the magic happen.</p>
        </div>`;
}

function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function renderHistory() {
    const list = DOMElements.historyList;
    list.innerHTML = '';
    
    if (state.history.length === 0) {
        list.innerHTML = `
            <div class="text-center py-8 px-4">
                <p class="text-sm text-gray-500">No history yet.</p>
                <p class="text-xs text-gray-500">Your generated images will appear here.</p>
            </div>`;
        DOMElements.clearHistoryButton.disabled = true;
        return;
    }

    DOMElements.clearHistoryButton.disabled = isApiKeyMissing || state.isLoading;

    state.history.forEach(item => {
        const isSelected = item.id === state.selectedHistoryId;
        const button = document.createElement('button');
        button.className = `w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed ${isSelected ? 'bg-indigo-600/30' : 'bg-gray-700/50 hover:bg-gray-700'}`;
        button.disabled = isApiKeyMissing || state.isLoading;
        button.dataset.id = item.id;
        
        const thumbnail = item.images[0]
            ? `<img src="data:image/jpeg;base64,${item.images[0]}" alt="History thumbnail" class="w-full h-full object-cover rounded-md" />`
            : `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>`;
        
        button.innerHTML = `
            <div class="w-14 h-14 flex-shrink-0 bg-gray-900 rounded-md flex items-center justify-center pointer-events-none">${thumbnail}</div>
            <div class="flex-grow overflow-hidden pointer-events-none">
                <p class="text-sm font-semibold text-gray-200 truncate">${item.options.prompt || 'Untitled'}</p>
                <p class="text-xs text-gray-400">${formatTimeAgo(item.timestamp)}</p>
            </div>
            <button data-action="delete" class="p-2 text-gray-500 rounded-full hover:bg-red-800/50 hover:text-red-400 transition-colors flex-shrink-0" aria-label="Delete history item">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.067-2.09 1.02-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"></path></svg>
            </button>
        `;

        const deleteButton = button.querySelector('[data-action="delete"]');
        deleteButton.disabled = isApiKeyMissing || state.isLoading;

        list.appendChild(button);
    });
}

function renderSideMenu() {
    if (state.isSideMenuOpen) {
        DOMElements.sideMenu.classList.remove('-translate-x-full');
        DOMElements.sideMenuOverlay.classList.remove('opacity-0', 'pointer-events-none');
    } else {
        DOMElements.sideMenu.classList.add('-translate-x-full');
        DOMElements.sideMenuOverlay.classList.add('opacity-0', 'pointer-events-none');
    }
}

function updateGenerateButtonState() {
    const isDisabled = !state.options.prompt.trim() || state.isLoading || isApiKeyMissing;
    DOMElements.generateButton.disabled = isDisabled;
    DOMElements.generateButtonText.textContent = state.isLoading ? 'Generating...' : 'Generate';

    const allInputs = DOMElements.settingsPanel.querySelectorAll('input, button, select, textarea');
    allInputs.forEach(input => {
        if (input.id !== 'generate-button') {
            input.disabled = state.isLoading || isApiKeyMissing;
        }
    });
}

function updatePromptActionButtons() {
    const { prompt, referenceImage } = state.options;
    const { promptLoadingAction } = state;

    const buttonConfigs = {
        improve: DOMElements.improvePromptButton,
        random: DOMElements.randomPromptButton,
        describe: DOMElements.describeImageButton,
    };
    
    for (const action in buttonConfigs) {
        const button = buttonConfigs[action];
        const isThisButtonLoading = promptLoadingAction === action;
        
        button.innerHTML = isThisButtonLoading ? SPINNER_SVG : originalButtonContent[action];
        
        let isDisabled = !!promptLoadingAction || isApiKeyMissing;
        if (action === 'improve' && !prompt.trim()) isDisabled = true;
        if (action === 'describe' && !referenceImage) isDisabled = true;
        
        button.disabled = isDisabled;
    }
}

// --- EVENT HANDLERS ---
function handleOptionsChange(key, value) {
    state.options[key] = value;
    renderSettings();
    updateGenerateButtonState();
    updatePromptActionButtons();
}

function handleSideMenuToggle(isOpen) {
    state.isSideMenuOpen = isOpen;
    renderSideMenu();
}

async function handleGenerate() {
    if (state.isLoading || !state.options.prompt.trim()) return;

    setState({ isLoading: true, error: null });

    try {
        const images = await geminiService.generateImages(state.options);
        const newHistoryItem = {
            id: `gen_${Date.now()}`,
            timestamp: Date.now(),
            options: { ...state.options },
            images: images,
        };
        
        const newHistory = [newHistoryItem, ...state.history];

        setState({
            history: newHistory,
            selectedHistoryId: newHistoryItem.id,
            isLoading: false
        });

        localStorage.setItem('generationHistory', JSON.stringify(newHistory));

    } catch (err) {
        setState({ error: err instanceof Error ? err.message : 'An unknown error occurred.', isLoading: false });
        console.error(err);
    }
}

function handleSelectHistory(id) {
    const selectedItem = state.history.find(item => item.id === id);
    if (selectedItem) {
        const fullOptions = {
            prompt: '', aspectRatio: '1:1',
            numberOfImages: 1, referenceImage: null, stylePreset: 'none',
            negativePrompt: '', seed: '',
            ...selectedItem.options,
        };
        setState({ options: fullOptions, selectedHistoryId: id, error: null });
    }
    handleSideMenuToggle(false);
}

function handleDeleteHistory(id) {
    const newHistory = state.history.filter(item => item.id !== id);
    let newState = { history: newHistory };

    if (state.selectedHistoryId === id) {
        const newSelectedId = newHistory[0]?.id ?? null;
        newState.selectedHistoryId = newSelectedId;

        if (newSelectedId) {
            const selectedItem = newHistory.find(item => item.id === newSelectedId);
            newState.options = {
                prompt: '', aspectRatio: '1:1', numberOfImages: 1, referenceImage: null, 
                stylePreset: 'none', negativePrompt: '', seed: '', ...selectedItem.options,
            };
        } else {
            newState.options = {
                ...state.options, prompt: '', referenceImage: null, negativePrompt: '', seed: '',
            };
            newState.error = null;
        }
    }

    setState(newState);
    localStorage.setItem('generationHistory', JSON.stringify(newHistory));
}

function handleClearHistory() {
    if (window.confirm("Are you sure you want to clear all history? This cannot be undone.")) {
        setState({
            history: [],
            selectedHistoryId: null,
            options: {...state.options, prompt: '', referenceImage: null, negativePrompt: '', seed: ''},
            error: null,
        });
        localStorage.setItem('generationHistory', JSON.stringify([]));
    }
}

function handleEditPrompt(historyItem) {
    const fullOptions = {
        prompt: '', aspectRatio: '1:1',
        numberOfImages: 1, referenceImage: null, stylePreset: 'none',
        negativePrompt: '', seed: '',
        ...historyItem.options,
    };
    setState({ options: fullOptions });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleDownloadImage(imageUrl, prompt) {
    const link = document.createElement('a');
    link.href = imageUrl;
    const safePrompt = prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `generated_${safePrompt || 'image'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function handlePromptAction(action) {
    setState({ promptLoadingAction: action });
    try {
        let newPrompt = '';
        if (action === 'improve') {
            newPrompt = await geminiService.improvePrompt(state.options.prompt);
        } else if (action === 'random') {
            newPrompt = await geminiService.getRandomPrompt();
        } else if (action === 'describe' && state.options.referenceImage) {
            newPrompt = await geminiService.describeImage(state.options.referenceImage.base64, state.options.referenceImage.mimeType);
        }
        if (newPrompt) {
            handleOptionsChange('prompt', newPrompt);
        }
    } catch (error) {
        console.error(error);
        alert(error instanceof Error ? error.message : "An error occurred.");
    } finally {
        setState({ promptLoadingAction: null });
    }
}

function handleHistoryClick(e) {
    const targetButton = e.target.closest('button[data-action]');
    const historyItemElement = e.target.closest('button[data-id]');

    if (targetButton && targetButton.dataset.action === 'delete') {
        if (historyItemElement) {
            e.stopPropagation(); 
            handleDeleteHistory(historyItemElement.dataset.id);
        }
    } else if (historyItemElement) {
        handleSelectHistory(historyItemElement.dataset.id);
    }
}

function handleGalleryClick(e) {
    const target = e.target.closest('button[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const imageWrapper = target.closest('.group');
    const img = imageWrapper?.querySelector('img');
    const generation = state.history.find(item => item.id === state.selectedHistoryId);

    if (!img || !generation) return;

    if (action === 'edit') {
        handleEditPrompt(generation);
    } else if (action === 'download') {
        handleDownloadImage(img.src, generation.options.prompt);
    }
}

// --- STATE MANAGEMENT ---
function setState(newState) {
    const oldState = { ...state };
    state = { ...state, ...newState };
    
    if (JSON.stringify(oldState.options) !== JSON.stringify(state.options)) renderSettings();
    if (oldState.isLoading !== state.isLoading || oldState.error !== state.error || oldState.selectedHistoryId !== state.selectedHistoryId) renderImageGallery();
    if (JSON.stringify(oldState.history) !== JSON.stringify(state.history) || oldState.selectedHistoryId !== state.selectedHistoryId || oldState.isLoading !== state.isLoading) renderHistory();
    if (oldState.isSideMenuOpen !== state.isSideMenuOpen) renderSideMenu();
    if (oldState.isLoading !== state.isLoading || oldState.options.prompt !== state.options.prompt) updateGenerateButtonState();
    if (oldState.promptLoadingAction !== state.promptLoadingAction || oldState.options.prompt !== state.options.prompt || oldState.options.referenceImage !== state.options.referenceImage) {
        updatePromptActionButtons();
    }
}

// --- INITIALIZATION ---
function init() {
    // Store original button content before any changes
    originalButtonContent.improve = DOMElements.improvePromptButton.innerHTML;
    originalButtonContent.random = DOMElements.randomPromptButton.innerHTML;
    originalButtonContent.describe = DOMElements.describeImageButton.innerHTML;
    
    // Banners
    if (localStorage.getItem('noticeDismissed') !== 'true') {
        DOMElements.noticeBanner.classList.remove('hidden');
    }
    DOMElements.dismissNoticeButton.addEventListener('click', () => {
        DOMElements.noticeBanner.classList.add('hidden');
        localStorage.setItem('noticeDismissed', 'true');
    });

    if (isApiKeyMissing) {
        DOMElements.apiKeyBanner.classList.remove('hidden');
        document.querySelectorAll('input, button, select, textarea').forEach(el => el.disabled = true);
    }

    // Load initial data
    try {
        const storedHistory = localStorage.getItem('generationHistory');
        if (storedHistory) {
            const parsedHistory = JSON.parse(storedHistory);
            const selectedId = parsedHistory[0]?.id ?? null;
            setState({ history: parsedHistory, selectedHistoryId: selectedId });
            if (selectedId) handleSelectHistory(selectedId);
        }
    } catch (e) {
        console.error("Failed to load history from localStorage", e);
        localStorage.removeItem('generationHistory');
    }

    // Set up event listeners (using delegation where possible)
    DOMElements.historyList.addEventListener('click', handleHistoryClick);
    DOMElements.imageGalleryContainer.addEventListener('click', handleGalleryClick);
    
    DOMElements.openMenuButton.addEventListener('click', () => handleSideMenuToggle(true));
    DOMElements.closeMenuButton.addEventListener('click', () => handleSideMenuToggle(false));
    DOMElements.sideMenuOverlay.addEventListener('click', () => handleSideMenuToggle(false));
    DOMElements.clearHistoryButton.addEventListener('click', handleClearHistory);

    DOMElements.promptInput.addEventListener('input', (e) => handleOptionsChange('prompt', e.target.value));
    DOMElements.negativePromptInput.addEventListener('input', (e) => handleOptionsChange('negativePrompt', e.target.value));
    DOMElements.seedInput.addEventListener('input', (e) => handleOptionsChange('seed', e.target.value));
    
    DOMElements.randomSeedButton.addEventListener('click', () => {
        const randomSeed = Math.floor(Math.random() * 1000000000);
        handleOptionsChange('seed', randomSeed.toString());
    });
    
    DOMElements.aspectRatioSelector.querySelectorAll('.aspect-ratio-button').forEach(btn => {
        btn.addEventListener('click', () => handleOptionsChange('aspectRatio', btn.dataset.value));
    });

    DOMElements.imageCountSelector.querySelectorAll('.image-count-button').forEach(btn => {
        btn.addEventListener('click', () => handleOptionsChange('numberOfImages', parseInt(btn.dataset.value)));
    });

    DOMElements.stylePresetSelector.addEventListener('change', (e) => handleOptionsChange('stylePreset', e.target.value));

    DOMElements.improvePromptButton.addEventListener('click', () => handlePromptAction('improve'));
    DOMElements.randomPromptButton.addEventListener('click', () => handlePromptAction('random'));
    DOMElements.describeImageButton.addEventListener('click', () => handlePromptAction('describe'));

    DOMElements.imageReferenceUploadButton.addEventListener('click', () => DOMElements.imageReferenceInput.click());
    DOMElements.imageReferenceInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
                const result = re.target?.result;
                if (typeof result === 'string') {
                    const base64 = result.split(',')[1];
                    if (base64) handleOptionsChange('referenceImage', { base64, mimeType: file.type });
                }
            };
            reader.readAsDataURL(file);
        }
    });
    DOMElements.imageReferenceRemoveButton.addEventListener('click', () => {
        handleOptionsChange('referenceImage', null);
        DOMElements.imageReferenceInput.value = "";
    });

    DOMElements.generateButton.addEventListener('click', handleGenerate);

    DOMElements.feedbackForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const feedback = DOMElements.feedbackInput.value;
        if (!feedback.trim()) return;
        console.log("Feedback submitted:", feedback);
        DOMElements.feedbackInput.value = '';
        DOMElements.feedbackInput.classList.add('hidden');
        DOMElements.feedbackSubmit.classList.add('hidden');
        DOMElements.feedbackSuccess.classList.remove('hidden');
        setTimeout(() => {
            DOMElements.feedbackSuccess.classList.add('hidden');
            DOMElements.feedbackInput.classList.remove('hidden');
            DOMElements.feedbackSubmit.classList.remove('hidden');
        }, 3000);
    });

    // Initial render
    renderAll();
}

document.addEventListener('DOMContentLoaded', init);