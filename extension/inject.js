(async () => {
    // Check if the circle already exists
    if (!document.getElementById('ai-assistance-circle')) {
        // the popup to manage 
        let popup = null;
        const session_id = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ contentScriptQuery: "get_session_id" }, function(response) {
                resolve(response);
            });
        });

        // Function to get tab-specific storage key
        function getTabStorageKey(session_id,keyword) {
            return 'session_'+session_id+"_" + keyword;
        }

        // Function to get storage for a specific tab
        async function getTabStorage(session_id, keyword, defaultValue) {
            return await new Promise((resolve) => {
                var tabStorageKey = getTabStorageKey(session_id, keyword);
                chrome.storage.local.get(tabStorageKey, function(result) {
                    resolve(result[tabStorageKey] !== undefined ? result[tabStorageKey] : defaultValue);
                });
            });
        }

        // Function to set storage for a specific tab
        async function setTabStorage(session_id, keyword,value) {
            const tabStorageKey = getTabStorageKey(session_id, keyword);
            var storageData = {};
            storageData[tabStorageKey] = value;
            chrome.storage.local.set(storageData);
        }

        async function pop_menu(){
                const circleRect = circle.getBoundingClientRect();
                const popupWidth = 300; // Adjust this width as needed
                const offsetHeight = 100;
                const popupX = Math.min(circleRect.right + 40, window.innerWidth - popupWidth - 50 );
                const popupY = Math.min(circleRect.top, window.innerHeight - offsetHeight - 50);
            
    
                // Step 4: Create and append the pop-up menu
                const popupContent = `
                <div style="position: fixed; left: ${popupX}px; top: ${popupY}px; background-color: white; padding: 10px; border: 1px solid #ddd; max-width: ${popupWidth}px; z-index: 2147483647;">
                    <!-- Close button -->
                    <button id="closeButton" style="position: absolute; top: 5px; right: 5px; cursor: pointer;">X</button>
            
                <form id="objective-form" style="display: flex; flex-direction: column;">
                    <label for="objective">What you would like to do?</label>
                    <textarea id="objective" style="margin-bottom: 8px;"></textarea>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <button type="submit" id="submit" style="background-color: #3498db; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">Submit</button>
                        <label class="switch" style="margin-left: 8px;">
                            <input type="checkbox" id="myCheckbox">
                            <span class="slider round"></span>
                            <span id="checkboxText">Act on my behalf</span> 
                        </label>
                    </div>
                </form>
                <div id="error"></div>
                </div>
                `;
                popup = document.createElement('div');
                popup.innerHTML = popupContent;

                document.body.appendChild(popup);
                

                const form = document.getElementById("objective-form");
                const objectiveInput = document.getElementById("objective");
                const submitButton = document.getElementById("submit");
                const active = document.getElementById("myCheckbox");
                const errorEl = document.getElementById("error");
                const checkboxText = document.getElementById("checkboxText");
                const closeButton = document.querySelector('#closeButton');
    
                const disabledElements = new Set();

                // Function to disable the currently focused element
                function disableFocusedElement() {
                    const focusedElement = document.activeElement;
                    if (focusedElement && focusedElement.tagName !== "BODY" & focusedElement !== objectiveInput & focusedElement !== submitButton ) {
                        focusedElement.setAttribute('disabled', 'disabled');
                        disabledElements.add(focusedElement)
                    }
                }

                function enableAllDisabledElements() {
                    for (const element of disabledElements) {
                        element.removeAttribute('tabindex');
                        element.removeAttribute('disabled');
                    }
                    disabledElements.clear();
                }

                // Event listener for 'click' on the objectiveInput
                objectiveInput.addEventListener('click', disableFocusedElement);
                objectiveInput.addEventListener('input', disableFocusedElement);

                // Event listener for 'blur' on the objectiveInput
                objectiveInput.addEventListener('blur', enableAllDisabledElements);

                closeButton.addEventListener('click', () => {
                    document.body.removeChild(popup);
                    popup = null; // Reset the variable
                    setTabStorage(session_id,"popup_enabled",false);
                });
    
                // populate with the stored fields
                // Retrieve stored values from local storage
                const storedIsChecked = await getTabStorage(session_id,"is_active",false);

                active.checked = storedIsChecked || false;
                
                const storedObjective = await getTabStorage(session_id,"objective","");
                objectiveInput.value = storedObjective || "";
                active.addEventListener("change", async function() {
                    if (active.checked) {
                        await setTabStorage(session_id,"is_active", true);
                    } else {
                        await setTabStorage(session_id,"is_active", false);
                    }
                    
                });
    
                // Add an event listener for 'input' event on the textarea to store the value
                objectiveInput.addEventListener("input", async function() {
                    // Store text field value in local storage on every change
                    await setTabStorage(session_id,"objective",objectiveInput.value)
                });
    
                form.addEventListener("submit", async (e) => {
                    //console.log('submit event dispatched');
                    e.preventDefault();
                    submitButton.setAttribute("disabled", true);
                    errorEl.textContent = ""
    
                    const objective = objectiveInput.value;
                    let body = undefined;
                    try{
                        const screenshotImage = await new Promise((resolve) => {
                            chrome.runtime.sendMessage({ contentScriptQuery: "take_screenshot" }, function(response) {
                                resolve(response);
                            });
                        });

                        const elements = await contentScript.main({
                            message: "extract",
                            script: "elements",
                        });
                        
    
                        const url = await contentScript.main({
                            message: "extract",
                            script: "get_url",
                        });
    
                        const {viewpointscroll,viewportHeight} = await contentScript.main({
                            message: "extract",
                            script: "window",
                        });
    
                        const scroll_width = await contentScript.main({
                            message: "extract",
                            script: "scroll_width",
                        });
    
                        const scroll_height = await contentScript.main({
                            message: "extract",
                            script: "scroll_height",
                        });
    
                        const {width,height} = await contentScript.main({
                            message: "extract",
                            script: "get_window_size",
                        });
    
                        console.log("sending request to the server.")
                        // console.log(screenshotImage)
                        body = JSON.stringify({
                            "viewpointscroll":viewpointscroll,
                            "viewportHeight":viewportHeight,
                            "scroll_width":scroll_width,
                            "scroll_height":scroll_height,
                            "width":width,
                            "height":height,
                            "raw_on_screen":elements,
                            "url":url,
                            "user_task":objective,
                            "session_id":session_id,
                            "screenshot":screenshotImage,
                        });
                        } catch (e) {
                            console.error(e.message)
    
                            if (e.message.includes("Could not establish connection. Receiving end does not exist.")){
                            errorEl.textContent  = `Please refresh the selected tab before continuing.`;
                            }
                            else{
                            errorEl.textContent  = `Extracting failed, Error: ${e.message}.`;
                            }
                        }
    
    
                    if (body != undefined){
                        let command = undefined;
                        let fallback_command = false;
                        try{
                            //const localHost = process.env.HOST || "localhost"; // "localhost" is the default if LOCAL_HOST is not set
                            const res = await fetch(`https://scrape_anything:3000/process`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body,
                            });
                            if (res.status != 200) {
                            // Handle the not 200 error case here
                            error_data = await res.json();
                            errorEl.textContent = `Internal Server Error: ${error_data.error_message}`;
                            } else {
                            // If the response is not a 500 error, proceed as normal
                            command = await res.json();
                            }
                        } catch (e) {
                            command = {"script": "server_fail",'tool_input':{},'force_guide':false}
                            errorEl.textContent  = `Server didn't responded.`;
                            fallback_command = true;
                        }
                        
                        if (command != undefined){
                            if (command.hasOwnProperty("script") | command.hasOwnProperty("tool_input")) {
                            try{
                                contentScript.main({
                                    message: "run_command",
                                    active:  (command.force_guide && command.force_guide === true)  ? false : active.checked,
                                    script: command.script,
                                    args: command.tool_input, 
                                }).then(
                                    function(response) {

                                    if (!fallback_command){
                                        body = JSON.stringify(Object.assign({}, response, {"session_id":session_id}))
                                        fetch(`https://scrape_anything:3000/status`, {
                                                method: "POST",
                                                headers: {
                                                "Content-Type": "application/json",
                                                },
                                                body
                                        }).catch((err) => {
                                            console.error("Failed to reported status "+err)
                                        });
                                           
                                    }
                            });
                            } catch (e){
                                errorEl.textContent  = `Executing guidance failed, Error: ${e.message}.`;
                            }
                            }
                            else{
                                console.error("response is corrupted.")
                            }
                        }
                        
                    }
                    
                    submitButton.removeAttribute("disabled");
                
                });
        }
        // Step 0: load imports
        const src = chrome.runtime.getURL('./content.js');
        const contentScript = await import(src);
    
        // Step 1: Create the round circle element
        const circle = document.createElement('div');
        circle.id = 'ai-assistance-circle';
        // Add an image icon inside the circle
        const icon = document.createElement('img');
        icon.src = chrome.runtime.getURL('cricle.png'); // Update with the correct path to your 128x128 icon
        icon.style.width = '100%';
        icon.style.height = '100%';
        
        icon.style.clipPath = 'circle(50% at center)';
        icon.style.webkitClipPath = 'circle(50% at center)';
    
        circle.appendChild(icon);
    
    
        // Step 2: define draggable
        // Additional code for making the circle draggable
        let isDragging = false;
        let offsetX, offsetY;
    
        // Function to handle the start of dragging
        function startDrag(e) {
            isDragging = true;
            offsetX = e.clientX - circle.getBoundingClientRect().left;
            offsetY = e.clientY - circle.getBoundingClientRect().top;
        }
    
        // Function to handle the dragging movement
        function dragMove(e) {
            if (isDragging) {
                const x = e.clientX - offsetX;
                const y = e.clientY - offsetY;
    
                circle.style.left = `${x}px`;
                circle.style.top = `${y}px`;
            }
        }
    
        // Function to handle the end of dragging
        function endDrag() {
            isDragging = false;
        }
    
        // Add event listeners for dragging
        circle.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', endDrag);
    
    
    
        // Step 3: Apply CSS styles directly in JavaScript
        circle.style.width = '50px';
        circle.style.height = '50px';
        circle.style.backgroundColor = '#3498db';
        circle.style.borderRadius = '50%';
        circle.style.position = 'fixed';
        circle.style.bottom = '20px';
        circle.style.right = '20px';
        circle.style.display = 'flex';
        circle.style.alignItems = 'center';
        circle.style.justifyContent = 'center';
        circle.style.cursor = 'pointer';
        circle.style.color = 'white';
        circle.style.fontWeight = 'bold';
        circle.style.zIndex = '2147483646';

        // Step 4: Add event listener to the circle element
        circle.addEventListener('click', async function () {
            if (popup) {
                // If pop-up is already open, close it by removing it from the DOM
                document.body.removeChild(popup);
                popup = null; // Reset the variable
                setTabStorage(session_id,"popup_enabled",false);
            } else {
                setTabStorage(session_id,"popup_enabled",true);
                // Calculate position for the popupContent near the circle
                await pop_menu()
            }
        });
        // Step 5: Append the circle to the DOM
        document.body.appendChild(circle);   

        // Step 6: repload popup 
        const popup_enabled = await getTabStorage(session_id,"popup_enabled",false);
        if (popup_enabled){
            await pop_menu()
        }
        
    }
    })();
    
