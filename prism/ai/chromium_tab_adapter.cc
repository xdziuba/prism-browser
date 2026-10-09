#include "prism/ai/chromium_tab_adapter.h"

#include <algorithm>
#include <utility>

#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/tabs/tab_enums.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "components/sessions/content/session_tab_helper.h"
#include "content/public/browser/browser_thread.h"
#include "content/public/browser/web_contents.h"
#include "ui/base/window_open_disposition.h"
#include "url/gurl.h"
#include "url/origin.h"

namespace prism::ai {
namespace {

constexpr int kMaxListedTabs = 200;

}  // namespace

ChromiumTabAdapter::ChromiumTabAdapter(
    base::WeakPtr<BrowserWindowInterface> browser)
    : browser_(std::move(browser)) {}

ChromiumTabAdapter::~ChromiumTabAdapter() = default;

int ChromiumTabAdapter::FindTabIndex(const TabStripModel& tabs,
                                     int tab_id) const {
  for (int index = 0; index < tabs.count(); ++index) {
    content::WebContents* contents = tabs.GetWebContentsAt(index);
    if (contents &&
        sessions::SessionTabHelper::IdForTab(contents).id() == tab_id) {
      return index;
    }
  }
  return -1;
}

Inspection ChromiumTabAdapter::Inspect(const ToolCall& call) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  Inspection result;
  if (!browser_ || browser_->IsDeleteScheduled()) {
    return result;
  }
  result.incognito = browser_->GetProfile()->IsOffTheRecord();
  if (result.incognito) {
    return result;
  }
  TabStripModel* tabs = browser_->GetTabStripModel();
  if (!tabs) {
    return result;
  }

  if (std::holds_alternative<TabsList>(call)) {
    result.valid = true;
  } else if (const auto* open = std::get_if<TabsOpen>(&call)) {
    const GURL url(open->url);
    result.valid = url.is_valid() && url.SchemeIsHTTPOrHTTPS() &&
                   url.username().empty() && url.password().empty();
    result.consequential = result.valid;
  } else if (const auto* close = std::get_if<TabsClose>(&call)) {
    result.valid = FindTabIndex(*tabs, close->tab_id) >= 0;
  } else if (const auto* activate = std::get_if<TabsActivate>(&call)) {
    result.valid = FindTabIndex(*tabs, activate->tab_id) >= 0;
  }
  result.redaction_ready = result.valid;
  return result;
}

ExecutionResult ChromiumTabAdapter::ExecuteTicket(
    const ExecutionTicket& ticket) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  if (ticket.cancelled->load()) {
    return {ExecutionStatus::kCancelled, {}};
  }
  const Inspection inspection = Inspect(ticket.call);
  if (!inspection.valid || inspection.incognito ||
      !inspection.redaction_ready || !browser_) {
    return {ExecutionStatus::kFailed, {}};
  }
  TabStripModel* tabs = browser_->GetTabStripModel();
  if (!tabs || ticket.cancelled->load()) {
    return {ExecutionStatus::kCancelled, {}};
  }

  if (std::holds_alternative<TabsList>(ticket.call)) {
    TabsListOutput listed;
    for (int index = 0; index < std::min(tabs->count(), kMaxListedTabs);
         ++index) {
      if (ticket.cancelled->load()) {
        return {ExecutionStatus::kCancelled, {}};
      }
      content::WebContents* contents = tabs->GetWebContentsAt(index);
      if (!contents) {
        continue;
      }
      TabSummary tab;
      tab.id = sessions::SessionTabHelper::IdForTab(contents).id();
      tab.active = contents == tabs->GetActiveWebContents();
      const GURL& url = contents->GetLastCommittedURL();
      if (url.SchemeIsHTTPOrHTTPS()) {
        tab.origin = url::Origin::Create(url).Serialize();
      }
      listed.tabs.push_back(std::move(tab));
    }
    listed.truncated = tabs->count() > kMaxListedTabs;
    return {ExecutionStatus::kCompleted, std::move(listed)};
  }

  if (const auto* open = std::get_if<TabsOpen>(&ticket.call)) {
    if (ticket.cancelled->load()) {
      return {ExecutionStatus::kCancelled, {}};
    }
    browser_->OpenGURL(GURL(open->url),
                       WindowOpenDisposition::NEW_FOREGROUND_TAB);
    return {ExecutionStatus::kCompleted,
            ActionAcknowledgement{AcknowledgementKind::kOpenRequested}};
  }

  if (const auto* close = std::get_if<TabsClose>(&ticket.call)) {
    const int index = FindTabIndex(*tabs, close->tab_id);
    if (index < 0 || ticket.cancelled->load()) {
      return {ExecutionStatus::kCancelled, {}};
    }
    tabs->CloseWebContentsAt(index, TabCloseTypes::CLOSE_USER_GESTURE);
    return {ExecutionStatus::kCompleted,
            ActionAcknowledgement{AcknowledgementKind::kCloseRequested}};
  }

  if (const auto* activate = std::get_if<TabsActivate>(&ticket.call)) {
    const int index = FindTabIndex(*tabs, activate->tab_id);
    if (index < 0 || ticket.cancelled->load()) {
      return {ExecutionStatus::kCancelled, {}};
    }
    tabs->ActivateTabAt(index);
    return {ExecutionStatus::kCompleted,
            ActionAcknowledgement{AcknowledgementKind::kActivated}};
  }
  return {ExecutionStatus::kFailed, {}};
}

}  // namespace prism::ai
