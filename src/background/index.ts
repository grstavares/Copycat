import handlers, { ContextMenusClickHandler, CommandComplicateHandler } from './handlers'
import menus from './menus'

async function writeTextToClipboard(text: string) {
  try {
    return await navigator.clipboard.writeText(text)
  } catch (e) {
    const textarea = document.createElement('textarea')
    textarea.textContent = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('Copy', false, null)
    document.body.removeChild(textarea)
  }
}

async function queryAllInjectableTabs(): Promise<browser.tabs.Tab[]> {
  const invalidList = [
    'about:'
  , 'browser:'
  , 'view-source:'
  , 'chrome:'
  , 'chrome-error:'
  , 'https://chrome.google.com/'
  ]
  const tabs = await browser.tabs.query({})
  return tabs.filter(({ url = '' }) => {
    return invalidList.every(invalid => !url.startsWith(invalid))
  })
}

// Inject after installed / available
browser.runtime.onInstalled.addListener(async () => {
  for (const { id } of await queryAllInjectableTabs()) {
    if (id) {
      const manifest = browser.runtime.getManifest()
      for (const file of manifest.content_scripts![0].js!) {
        browser.tabs.executeScript(id, {
          file
        , allFrames: true
        , matchAboutBlank: true
        , runAt: 'document_end' as browser.extensionTypes.RunAt
        })
      }
    }
  }
})

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const text = await (handlers[info.menuItemId] as ContextMenusClickHandler)(info, tab)
  if (text) {
    await writeTextToClipboard(text)
  }
})

browser.commands.onCommand.addListener(async command => {
  const tabs = await browser.tabs.query({ currentWindow: true, active: true })
  if (tabs.length) {
    const text = await (handlers[command] as CommandComplicateHandler)({}, tabs[0])
    if (text) {
      await writeTextToClipboard(text)
    }
  }
})

;
(async () => {
  // Register menus
  await browser.contextMenus.removeAll()
  for (const [contexts, items] of menus.entries()) {
    for (const item of items) {
      if (!item.type && item.id) {
        item.type = 'normal'
        item.title = browser.i18n.getMessage(item.id)
      }
      item.contexts = contexts
      browser.contextMenus.create(item as any)
    }
  }
})()
