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

//Catch errors because if you don't it just says "Service worker registration failed" and doesn't tell you why
try {
  main();
} catch (e) {
  console.error(e);
}


async function main() {
  let options = {
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
  }
  chrome.storage.onChanged.addListener((changes) => {
    let n = changes.settings.newValue;
    console.log(n);
    options = n;
  })
  chrome.action.setTitle({title: "Group, collapse, and ungroup tabs."})
  
  //Look for existing groups and figure out where to continue color scheme.
  var next = 0;
  const _groups = await chrome.tabGroups.query({
    windowId: chrome.windows.WINDOW_ID_CURRENT,
  });
  if (_groups.length) {
    next = options.COLORS.indexOf(_groups[0].color);
  }
    
  //Listeners
  console.log(chrome.action);
  console.log("ok");
  //chrome.action.onClicked.addListener(group);
  chrome.commands.onCommand.addListener(cmd);
  chrome.runtime.onMessage.addListener(({command}) => cmd(command));
  function cmd(command){
    console.log({command});
    switch(command){
        case "group":
            group();
            break;
        case "ungroup":
            ungroup();
            break;
        case "collapse":
            collapse();
    }
  }
  //Window switching collapse tabs
  chrome.tabs.onActivated.addListener(() => options.COLLAPSE && options.COLLAPSE_WHEN_SWITCHING && collapse());
  //Ungroup too small groups
  chrome.tabs.onRemoved.addListener(ungroup_small);
  chrome.tabs.onUpdated.addListener(ungroup_small);
  
  async function ungroup_small(){
    if (options.UNGROUP_SMALL){
        let groups = {};
        const tabs = await chrome.tabs.query({ currentWindow: true });
        //Get list of groups and their tabs.
        tabs.forEach(i => {
            groups[i.groupId] = groups[i.groupId] || [];
            groups[i.groupId].push(i.id);
        });
        console.log("Got %o", {groups});
        Object.entries(groups).filter(([id, {length}]) => length < options.MIN_TABS).forEach(([_, tabs]) => {
            console.log("Ungrouping %o", tabs);
            chrome.tabs.ungroup(tabs);
        })
    }
  }
  async function ungroup(){
    const tabs = await chrome.tabs.query({ currentWindow: true });
    chrome.tabs.ungroup(tabs.map(i => i.id));
  }
  
  async function collapse() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const [tab] = await chrome.tabs.query({
      currentWindow: true,
      active: true,
    });
    (
      await chrome.tabGroups.query({
        windowId: chrome.windows.WINDOW_ID_CURRENT,
      })
    ).forEach(async (item) => {
      const collapsed = !tabs
        .filter((i) => i.groupId === item.id)
        .map((i) => i.id)
        .some((i) => i === tab.id);
      await chrome.tabGroups.update(item.id, {
        collapsed: options.COLLAPSE_FOCUSED ? true : collapsed,
      });
    });
  }
  
  //If auto grouping is enabled
  if (options.AUTO_GROUP) {
    chrome.tabs.onUpdated.addListener(async (tabId, { status }) => {
      //Only do this once per page load.
      if (status !== "loading") return;
        
        
      const tab = await chrome.tabs.get(tabId);
      console.log(tab.url);
      const origin = url(tab.url);
      
      //If the tab is already in a group and the group is fine don't do anything
      if (tab.groupId !== -1){
          console.log(tab.groupId);
        const currentGroup = await chrome.tabGroups.get(tab.groupId);
        if (currentGroup.title === origin) return console.log("Same as existing");
      }
      
      //If there is an existing group of the new origin of the tab then add the tab to that and return (prevents weird glitches and changing colors)
      const allGroups = await chrome.tabGroups.query({
        windowId: chrome.windows.WINDOW_ID_CURRENT,
      })
      var found = allGroups.find(i => i.name === origin);
      if (found){
        chrome.tabs.group({tabIds: [tab.id], groupId: found.id});
        return console.log("Found existing group");
      }
        
      //Get all the current tabs and filter them to find the ones on the origin.
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const originTabs = tabsOnOrigin({ origin, tabs });
        
      //If the new url of the tab updated is the same as the origin of the other tabs then return.
      if (await same()) return console.log("Same as existing group");
      console.log(`Tabs on origin ${origin}`, originTabs);
        
      //Info to group tabs
      var updateInfo = {
        tabIds: originTabs.map((i) => i.id),
      };
        
      //Ungroup from existing group if tabs are less than minimum
      if (originTabs.length < options.MIN_TABS) return chrome.tabs.ungroup(tab.id);
        
      //Group the tabs
      const id = await chrome.tabs.group(updateInfo);
        
      //Test to see if group should be collapsed.
      const collapsed = options.COLLAPSE_FOCUSED
        ? true
        : !tabs.map((i) => i.id).some((i) => i === tab.id);
        
      //Options to update the tab group.
      updateInfo = {
        title: options.TITLE ? origin : undefined,
        collapsed: options.COLLAPSE ? collapsed : false,
      };
      if (options.RAINBOW) {
        //Update the tab group's color if it's a new group
        updateInfo.color = options.COLORS[++next % options.COLORS.length];
      }
      await chrome.tabGroups.update(id, updateInfo);
        
      //Collapse groups as needed.
      options.COLLAPSE && collapse();
        
        
      async function same() {
        //return false;
        if (tab.groupId) {
          var g = await chrome.tabs.query({ groupId: tab.groupId });
          console.log(`Tabs in group: `, g);
          return g.length && g.every((item) => url(item.url) === origin);
        } else {
          return console.log("No groupID");
        }
      }
    });
  }
    
  //Group all tabs
  async function group() {
    //This groups list is a list of the groups. That way the groups can be grouped all at once, making the grouping significantly faster.
    var groups = [];
    const tabs = await chrome.tabs.query({ currentWindow: true });
    console.log(`Tabs:`, tabs);
    
    //Find all the origins of all the tabs in the current window.
    var origins = [];
    origins.push(...tabs.map((i) => url(i.url)));
    origins = origins.unique();
    let i = 1;
    //Current tab. Used for collapsing.
    var [current] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    for (let origin of origins) {
      let item = {};
      const tbs = tabsOnOrigin({ origin, tabs });
      item = {
        tabIds: tbs.map((i) => i.id),
      };
      item = {
        ...item,
        title: options.TITLE ? url(tbs[0].url) : undefined,
        collapsed: options.COLLAPSE_FOCUSED
          ? true
          : !tbs.map((i) => i.id).some((i) => i === current.id),
      };
      groups.push(item);
    }
    console.log({ origins, groups });
    
    //Group all tabs
    i = 0;
    //Random color offset for tab group colors
    const roff = Math.floor(Math.random() * options.COLORS.length);
    for (let item of groups) {
      //Check that it's actually wanted by the user
      if (item.tabIds.length < options.MIN_TABS) continue;
      // This returns the ID of the new tab group. (THANKS CHROME THIS WAS SO HARD TO FIGURE OUT)
      const id = await chrome.tabs.group({ tabIds: item.tabIds });
      var updateProps = {
        title: options.TITLE ? item.title : undefined,
        collapsed: options.COLLAPSE ? item.collapsed : false,
      };
      if (options.RAINBOW) {
        var offset = i++;
        if (options.RANDOM_OFFSET) {
          offset += roff;
          console.log({ offset, roff });
        }
        offset = offset % options.COLORS.length;
        next = offset;
        updateProps.color = options.COLORS[offset];
      }
      await chrome.tabGroups.update(id, updateProps);
    }
  }
    
  //Get the origin of a tab in a nice way. E.g. "https://google.com" comes out to be "Google" and "https://github.com" returns "Github"
  function url(u) {
    switch (options.NAMING){
        case "domain":
            try { return new URL(u).hostname.caps() } catch(_){ return "chrome".caps() };
            break;
        //"formatted"
        default:
            if (u.startsWith("chrome-distiller://")) return "Reader Mode".caps();
            if (u.startsWith("chrome-extension://")) return "Chrome extension".caps();
            try {
              //return new URL(u).hostname;
              const urlParts = new URL(u).hostname.split(".");
              return urlParts
                .slice(0)
                .slice(-(urlParts.length === 4 ? 3 : 2))
                .join(".")
                .split(".")[0]
                .caps();
            } catch (e) {
              return "Chrome".caps();
            };
            break;
    }
  }
    
  //Find all the tabs on a specific origin.
  function tabsOnOrigin({ origin, tabs }) {
    return tabs.filter((i) => url(i.url) == origin);
  }
    
   //Capitalize the first letter of a string
String.prototype.caps = function () {
  switch (options.CAPS_SETTING){
      case "caps":
          return this[0].toUpperCase() + this.slice(1);
          break;
      case "uppercase":
          return this.toUpperCase();
          break;
      case "lowercase":
          return this.toLowerCase();
          break;
  }
};

//Make an array unique
Array.prototype.unique = function () {
  return [...new Set(this)];
};
}