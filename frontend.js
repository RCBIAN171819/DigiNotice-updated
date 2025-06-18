// frontend.js - Handles dashboard functionality for the Digital Notice Board

document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const fileUploadInput = document.getElementById('file-upload');
    const uploadFilesBtn = document.getElementById('upload-files-btn');
    const uploadContainer = document.getElementById('upload-container');
    const fileListContainer = document.getElementById('file-list');
    const textAnnouncement = document.getElementById('text-announcement');
    const textColor = document.getElementById('text-color');
    const textSize = document.getElementById('text-size');
    const displayDuration = document.getElementById('display-duration');
    const addTextBtn = document.getElementById('add-text-btn');
    const previewFrame = document.getElementById('preview-frame');

    // Selected files for upload
    let selectedFiles = [];

    // Drag and drop functionality
    uploadContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadContainer.classList.add('dragover');
    });

    uploadContainer.addEventListener('dragleave', () => {
        uploadContainer.classList.remove('dragover');
    });

    uploadContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadContainer.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files);
        }
    });

    fileUploadInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files);
        }
    });

    // Handle file selection
    function handleFileSelection(files) {
        selectedFiles = Array.from(files);
        
        // Show selected file names
        if (selectedFiles.length > 0) {
            let fileNames = selectedFiles.map(file => file.name).join(', ');
            uploadContainer.innerHTML = `
                <p>Selected ${selectedFiles.length} file(s):</p>
                <p style="font-size: 14px; word-break: break-all;">${fileNames}</p>
                <p style="color: blue; text-decoration: underline; margin-top: 10px;">Change selection</p>
            `;
            fileUploadInput.value = '';
        }
    }

    // Upload files button click handler
    uploadFilesBtn.addEventListener('click', () => {
        if (selectedFiles.length === 0) {
            alert('Please select files to upload first.');
            return;
        }

        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });

        // Show uploading status
        uploadContainer.innerHTML = '<p>Uploading files...</p>';
        
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Upload failed');
            }
            return response.json();
        })
        .then(data => {
            // Reset the upload container
            uploadContainer.innerHTML = `
                <img class="upload-icon" src="https://cdn-icons-png.flaticon.com/512/2989/2989981.png" alt="Upload">
                <p class="upload-text">Drag & drop files or <span style="color: blue; text-decoration: underline;">click to browse</span></p>
                <p class="upload-formats">Supported formats: JPEG, PNG, GIF, MP4</p>
            `;
            
            // Reset selected files
            selectedFiles = [];
            
            // Refresh file list
            loadContentItems();
            
            alert(`Successfully uploaded ${data.uploaded} file(s)`);
        })
        .catch(error => {
            console.error('Error uploading files:', error);
            uploadContainer.innerHTML = `
                <img class="upload-icon" src="https://cdn-icons-png.flaticon.com/512/2989/2989981.png" alt="Upload">
                <p class="upload-text">Drag & drop files or <span style="color: blue; text-decoration: underline;">click to browse</span></p>
                <p class="upload-formats">Supported formats: JPEG, PNG, GIF, MP4</p>
                <p style="color: red; margin-top: 10px;">Upload failed. Please try again.</p>
            `;
        });
    });

    // Add text announcement button click handler
    addTextBtn.addEventListener('click', () => {
        const text = textAnnouncement.value.trim();
        
        if (!text) {
            alert('Please enter text for the announcement.');
            return;
        }
        
        const textData = {
            type: 'text',
            content: text,
            color: textColor.value,
            size: textSize.value,
            duration: parseInt(displayDuration.value, 10) || 30
        };
        
        fetch('/api/text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(textData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to add text announcement');
            }
            return response.json();
        })
        .then(data => {
            // Clear the text input
            textAnnouncement.value = '';
            
            // Refresh file list
            loadContentItems();
            
            alert('Text announcement added successfully');
        })
        .catch(error => {
            console.error('Error adding text:', error);
            alert('Failed to add text announcement. Please try again.');
        });
    });

    // Load content items function
    function loadContentItems() {
        fetch('/api/content')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch content items');
                }
                return response.json();
            })
            .then(items => {
                // Clear the file list
                fileListContainer.innerHTML = '';
                
                if (items.length === 0) {
                    fileListContainer.innerHTML = '<div class="file-item">No content items available</div>';
                    return;
                }
                
                // Render each content item
                items.forEach((item, index) => {
                    const itemElement = document.createElement('div');
                    itemElement.className = 'file-item';
                    
                    let itemContent = '';
                    if (item.type === 'image') {
                        itemContent = `<div><span style="font-weight: bold;">Image:</span> ${item.filename}</div>`;
                    } else if (item.type === 'video') {
                        itemContent = `<div><span style="font-weight: bold;">Video:</span> ${item.filename}</div>`;
                    } else if (item.type === 'text') {
                        const truncatedText = item.content.length > 30 ? 
                                             item.content.substring(0, 30) + '...' : 
                                             item.content;
                        itemContent = `<div><span style="font-weight: bold;">Text:</span> ${truncatedText}</div>`;
                    }
                    
                    const actionsHtml = `
                        <div class="file-actions">
                            <button class="btn btn-secondary btn-move" data-index="${index}" data-direction="up">↑</button>
                            <button class="btn btn-secondary btn-move" data-index="${index}" data-direction="down">↓</button>
                            <button class="btn btn-danger btn-delete" data-id="${item.id}">Delete</button>
                        </div>
                    `;
                    
                    itemElement.innerHTML = itemContent + actionsHtml;
                    fileListContainer.appendChild(itemElement);
                });
                
                // Add event listeners for move and delete buttons
                document.querySelectorAll('.btn-move').forEach(button => {
                    button.addEventListener('click', handleMoveItem);
                });
                
                document.querySelectorAll('.btn-delete').forEach(button => {
                    button.addEventListener('click', handleDeleteItem);
                });
            })
            .catch(error => {
                console.error('Error loading content items:', error);
                fileListContainer.innerHTML = '<div class="file-item">Error loading content items</div>';
            });
    }

    // Handle move item
    function handleMoveItem(e) {
        const index = parseInt(e.target.dataset.index, 10);
        const direction = e.target.dataset.direction;
        
        fetch('/api/reorder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ index, direction })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to reorder item');
            }
            return response.json();
        })
        .then(data => {
            // Refresh file list
            loadContentItems();
        })
        .catch(error => {
            console.error('Error reordering item:', error);
            alert('Failed to reorder item. Please try again.');
        });
    }

    // Handle delete item
    function handleDeleteItem(e) {
        const id = e.target.dataset.id;
        
        if (confirm('Are you sure you want to delete this item?')) {
            fetch(`/api/content/${id}`, {
                method: 'DELETE'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to delete item');
                }
                return response.json();
            })
            .then(data => {
                // Refresh file list
                loadContentItems();
                alert('Item deleted successfully');
            })
            .catch(error => {
                console.error('Error deleting item:', error);
                alert('Failed to delete item. Please try again.');
            });
        }
    }

    // Function to refresh preview iframe
    function refreshPreview() {
        // Add a timestamp to bypass cache
        previewFrame.src = `/display.html?t=${Date.now()}`;
    }

    // Refresh button event listener
    document.querySelector('.btn-refresh').addEventListener('click', refreshPreview);

    // Initial load of content items
    loadContentItems();

    // Set up WebSocket for real-time updates
    const socket = new WebSocket(`ws://${window.location.host}/ws`);
    socket.onmessage = function(event) {
        const message = JSON.parse(event.data);
        if (message.type === 'content-updated') {
            loadContentItems(); // Refresh content when updated
        }
    };
});