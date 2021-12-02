const $ = (s) => document.querySelector(s);

let [group, collapse, ungroup, settings] = [$("#group"), $("#collapse"), $("#ungroup"), $("#settings")];

settings.onclick = () => chrome.runtime.openOptionsPage();
group.onclick = sendMsg("group");
collapse.onclick = sendMsg("collapse");
ungroup.onclick = sendMsg("ungroup");

group.focus();

window.onkeyup = ({key}) => {
    if (key === "Enter") document.querySelector("button:focus")?.click();
    if (key === "ArrowRight" || key === "ArrowDown"){
        document.querySelector("*:focus").nextElementSibling.focus();
    }
    if (key === "ArrowLeft" || key === "ArrowUp"){
        document.querySelector("*:focus").previousElementSibling.focus();
    }
};

function sendMsg(msg){
    return () => {
        chrome.runtime.sendMessage({command: msg})
    }
}