(async () => {
let storage = {
    get: (item) => {
        return new Promise(res => {
            chrome.storage.sync.get([item], (s) => res(s[item]))
        })
    },
    set: (item, val) => {
        return new Promise(res => {
            chrome.storage.sync.set({[item]: val}, (s) => res())
        })
    },
}

let settings = {
    //Automatically ungroup groups smaller than MIN_TABS
    UNGROUP_SMALL: true,
    //Groups should contain at least this number to be collapsed
    MIN_TABS: 2,
    //Customizeable colors
    COLORS: ["red", "yellow", "green", "cyan", "blue", "purple", "pink"],
    //Random offset in rainbow, e.g. start with green
    RANDOM_OFFSET: true,
    //Color in rainbow
    RAINBOW: true,
    //Automatically group when tabs are created, updated, closed
    AUTO_GROUP: true,
    //Auto collapse groups
    COLLAPSE: false,
    //Collapse the focused groups
    COLLAPSE_FOCUSED: false,
    //Give groups a title?
    TITLE: true,
    COLLAPSE_WHEN_SWITCHING: true,//Also requires COLLAPSE to be true
    NAMING: "formatted",//Either "formatted" ("Youtube", "Google", "Discord"), "domain" ("discord.com", "google.com", "youtube.com")
    CAPS_SETTING: "caps", //Either "caps", ("Youtube", "Google", "Discord"), "lowercase" ("youtube", "google", "discord") or "uppercase" ("YOUTUBE", "GOOGLE", "DISCORD")
    ...(await storage.get("settings"))
};

init();
update();

function init(){
    for (let input of document.querySelectorAll("input")){
        let val = settings[input.id];
        if (input.type === "checkbox"){
            input.parentElement.classList.add("form-switch");
            let i = document.createElement("i");
            input.insertAdjacentElement("afterend", i);
            input.checked = val;
            console.log({type: input.type, val});
            continue;
        }
        if (input.type === "radio"){
            val = settings[input.name];
            console.log({type: input.type, val});
            if (input.value === val){
                input.checked = true;
            } else {input.checked = false}
            continue;
        }
        input.value = val;
    }
}
for (let input of document.querySelectorAll("input")){
    let fn = ({target: {value}}) => {
        if (input.type === "checkbox"){
            value = input.checked;
        }
        if (input.type === "number"){
            value = parseInt(input.value);
        }
        if (input.type === "radio"){
            value = document.querySelector(`[name="${input.name}"]:checked`).value;
        }
        settings[input.name || input.id] = value;
        console.log({value, settings});
        update();
    }
    input.onchange = fn;
    input.oninput = fn;
}

function update(){
    [...document.querySelectorAll("input[data-requires]")].forEach(el => {
        let item = el.getAttribute("data-requires");
        console.log(item, settings[item]);
        if (!settings[item]){
            el.setAttribute("disabled", "true");
        } else {
            el.removeAttribute("disabled");
        }
    })
    storage.set("settings", settings);
}
})();