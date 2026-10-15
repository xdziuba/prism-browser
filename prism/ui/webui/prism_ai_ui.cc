#include "prism/ui/webui/prism_ai_ui.h"

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <utility>

#include "base/environment.h"
#include "base/functional/bind.h"
#include "base/location.h"
#include "base/memory/ref_counted_memory.h"
#include "base/memory/weak_ptr.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/task/sequenced_task_runner.h"
#include "base/values.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/global_browser_collection.h"
#include "chrome/browser/ui/side_panel/side_panel_ui.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/webui/webui_embedding_context.h"
#include "components/sessions/content/session_tab_helper.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/navigation_entry.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "content/public/browser/web_ui_message_handler.h"
#include "prism/ai/ai_session_service.h"
#include "prism/ai/chromium_browser_tool_service.h"
#include "prism/ai/page_context.h"
#include "prism/credentials/credential_store.h"
#include "prism/ui/webui/resources.h"
#include "services/network/public/cpp/shared_url_loader_factory.h"

namespace prism::ui {
namespace {

bool HasPrismResource(const std::string& path) {
  return path.empty() || path == "app.css" || path == "app.js";
}

void ServePrismResource(const std::string& path,
                        content::WebUIDataSource::GotDataCallback completion) {
  const char* response = path.empty()        ? kPrismAiHtml
                         : path == "app.css" ? kPrismAiCss
                                             : kPrismAiJs;
  std::move(completion)
      .Run(base::MakeRefCounted<base::RefCountedString>(std::string(response)));
}

std::optional<ai::Capability> CapabilityFromName(const std::string& name) {
  if (name == "read") {
    return ai::Capability::kRead;
  }
  if (name == "navigate") {
    return ai::Capability::kNavigate;
  }
  if (name == "interact") {
    return ai::Capability::kInteract;
  }
  return std::nullopt;
}

std::string ApprovalDetails(const ai::ToolCall& call) {
  if (const auto* open = std::get_if<ai::TabsOpen>(&call)) {
    return "Open this URL in a new tab: " + open->url;
  }
  if (const auto* close = std::get_if<ai::TabsClose>(&call)) {
    return "Close tab #" + base::NumberToString(close->tab_id);
  }
  return std::string("Allow once: ") + ai::Describe(call).name;
}

}  // namespace

class PrismAiMessageHandler : public content::WebUIMessageHandler {
 public:
  PrismAiMessageHandler() = default;
  ~PrismAiMessageHandler() override = default;

  base::WeakPtr<PrismAiMessageHandler> GetWeakPtr() {
    return weak_factory_.GetWeakPtr();
  }

  void StopForPanelHide() {
    const bool preview_was_pending = preview_pending_;
    if (preview_tools_) {
      preview_tools_->Stop();
      preview_tools_.reset();
    }
    ClearPreviewState();
    if (preview_was_pending && IsJavascriptAllowed()) {
      PreviewError("Preview stopped when the panel closed.");
    }
    if (session_) {
      session_->Stop();
      session_.reset();
    }
  }

  void RegisterMessages() override {
    web_ui()->RegisterMessageCallback(
        "prismReady", base::BindRepeating(&PrismAiMessageHandler::HandleReady,
                                          base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "prismStart", base::BindRepeating(&PrismAiMessageHandler::HandleStart,
                                          base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "prismStartSaved",
        base::BindRepeating(&PrismAiMessageHandler::HandleStartSaved,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "prismRemoveKey",
        base::BindRepeating(&PrismAiMessageHandler::HandleRemoveKey,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "prismSend", base::BindRepeating(&PrismAiMessageHandler::HandleSend,
                                         base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "prismGrant", base::BindRepeating(&PrismAiMessageHandler::HandleGrant,
                                          base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "prismApprove",
        base::BindRepeating(&PrismAiMessageHandler::HandleApprove,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "prismReject", base::BindRepeating(&PrismAiMessageHandler::HandleReject,
                                           base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "prismStop", base::BindRepeating(&PrismAiMessageHandler::HandleStop,
                                         base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "prismAudit", base::BindRepeating(&PrismAiMessageHandler::HandleAudit,
                                          base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "prismOpenPanel",
        base::BindRepeating(&PrismAiMessageHandler::HandleOpenPanel,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "prismPreviewPage",
        base::BindRepeating(&PrismAiMessageHandler::HandlePreviewPage,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "prismPreviewSelectedTabs",
        base::BindRepeating(&PrismAiMessageHandler::HandlePreviewSelectedTabs,
                            base::Unretained(this)));
  }

  void OnJavascriptDisallowed() override {
    weak_factory_.InvalidateWeakPtrs();
    if (preview_tools_) {
      preview_tools_->Stop();
      preview_tools_.reset();
    }
    ClearPreviewState();
    session_.reset();
  }

 private:
  void PreviewError(const char* message) {
    base::DictValue response;
    response.Set("ok", false);
    response.Set("error", message);
    FireWebUIListener("prism-page-preview", response);
  }

  void ClearPreviewState() {
    preview_pending_ = false;
    preview_tab_ids_.clear();
    preview_navigation_ids_.clear();
    preview_index_ = 0;
    preview_text_.clear();
    preview_origin_.clear();
    preview_truncated_ = false;
    preview_multiple_ = false;
    preview_browser_.reset();
  }

  bool SubmitPreviewTab() {
    if (!preview_tools_ || preview_index_ >= preview_tab_ids_.size()) {
      return false;
    }
    return preview_tools_
               ->Submit(ai::PageSnapshot{preview_tab_ids_[preview_index_]})
               .state == ai::ActionState::kStarted;
  }

  void StartPreview(BrowserWindowInterface* browser,
                    std::vector<int> tab_ids,
                    std::vector<int> navigation_ids,
                    bool multiple) {
    preview_tools_.reset();
    preview_tab_ids_ = std::move(tab_ids);
    preview_navigation_ids_ = std::move(navigation_ids);
    preview_index_ = 0;
    preview_text_.clear();
    preview_origin_.clear();
    preview_truncated_ = false;
    preview_multiple_ = multiple;
    preview_browser_ = browser->GetWeakPtr();
    preview_tools_ =
        std::make_unique<ai::ChromiumBrowserToolService>(preview_browser_);
    preview_tools_->SetCompletionObserver(base::BindRepeating(
        &PrismAiMessageHandler::OnPreviewComplete, weak_factory_.GetWeakPtr()));
    if (!preview_tools_->BeginTask()) {
      preview_tools_.reset();
      ClearPreviewState();
      PreviewError("Page preview could not start.");
      return;
    }
    preview_tools_->Grant(ai::Capability::kRead);
    if (!SubmitPreviewTab()) {
      preview_tools_->Stop();
      ClearPreviewState();
      PreviewError("The selected page could not be read.");
      return;
    }
    preview_pending_ = true;
  }

  bool PreviewTabsStillCurrent() const {
    if (!preview_browser_ || preview_browser_->IsDeleteScheduled()) {
      return false;
    }
    TabStripModel* tabs = preview_browser_->GetTabStripModel();
    if (!tabs) {
      return false;
    }
    for (std::size_t selected = 0; selected < preview_tab_ids_.size();
         ++selected) {
      bool found = false;
      for (int index = 0; index < tabs->count(); ++index) {
        content::WebContents* contents = tabs->GetWebContentsAt(index);
        if (!contents || sessions::SessionTabHelper::IdForTab(contents).id() !=
                             preview_tab_ids_[selected]) {
          continue;
        }
        content::NavigationEntry* entry =
            contents->GetController().GetLastCommittedEntry();
        if (!entry ||
            entry->GetUniqueID() != preview_navigation_ids_[selected] ||
            !contents->GetLastCommittedURL().SchemeIsHTTPOrHTTPS()) {
          return false;
        }
        found = true;
        break;
      }
      if (!found) {
        return false;
      }
    }
    return true;
  }

  void HandlePreviewPage(const base::ListValue& args) {
    if (!IsJavascriptAllowed() || !args.empty() ||
        !web_ui()->GetController()->GetAs<PrismAiPanelUI>()) {
      return;
    }
    if (preview_pending_) {
      return;
    }
    Profile* profile = Profile::FromWebUI(web_ui());
    BrowserWindowInterface* browser =
        webui::GetBrowserWindowInterface(web_ui()->GetWebContents());
    if (!profile || profile->IsOffTheRecord() || !browser ||
        browser->GetProfile() != profile || browser->IsDeleteScheduled()) {
      PreviewError("Page preview is unavailable in this window.");
      return;
    }
    TabStripModel* tabs = browser->GetTabStripModel();
    content::WebContents* page = tabs ? tabs->GetActiveWebContents() : nullptr;
    if (!page || !page->GetLastCommittedURL().SchemeIsHTTPOrHTTPS()) {
      PreviewError("Open an HTTP or HTTPS page to preview its context.");
      return;
    }
    const int tab_id = sessions::SessionTabHelper::IdForTab(page).id();
    if (tab_id <= 0) {
      PreviewError("The active tab is not ready for a preview.");
      return;
    }
    content::NavigationEntry* entry =
        page->GetController().GetLastCommittedEntry();
    if (!entry) {
      PreviewError("The active tab is not ready for a preview.");
      return;
    }
    StartPreview(browser, {tab_id}, {entry->GetUniqueID()}, false);
  }

  void HandlePreviewSelectedTabs(const base::ListValue& args) {
    if (!IsJavascriptAllowed() || !args.empty() ||
        !web_ui()->GetController()->GetAs<PrismAiPanelUI>() ||
        preview_pending_) {
      return;
    }
    Profile* profile = Profile::FromWebUI(web_ui());
    BrowserWindowInterface* browser =
        webui::GetBrowserWindowInterface(web_ui()->GetWebContents());
    if (!profile || profile->IsOffTheRecord() || !browser ||
        browser->GetProfile() != profile || browser->IsDeleteScheduled()) {
      PreviewError("Selected-tab preview is unavailable in this window.");
      return;
    }
    TabStripModel* tabs = browser->GetTabStripModel();
    if (!tabs) {
      PreviewError("No tabs are available in this window.");
      return;
    }
    const auto& indices =
        tabs->selection_model().GetListSelectionModel().selected_indices();
    if (indices.size() < 2 || indices.size() > 3) {
      PreviewError("Select two or three tabs in the tab strip first.");
      return;
    }
    std::vector<int> tab_ids;
    std::vector<int> navigation_ids;
    for (std::size_t index : indices) {
      content::WebContents* page =
          index < static_cast<std::size_t>(tabs->count())
              ? tabs->GetWebContentsAt(static_cast<int>(index))
              : nullptr;
      content::NavigationEntry* entry =
          page ? page->GetController().GetLastCommittedEntry() : nullptr;
      const int tab_id =
          page ? sessions::SessionTabHelper::IdForTab(page).id() : 0;
      if (!page || !page->GetLastCommittedURL().SchemeIsHTTPOrHTTPS() ||
          !entry || tab_id <= 0) {
        PreviewError("Only selected HTTP or HTTPS tabs can be previewed.");
        return;
      }
      tab_ids.push_back(tab_id);
      navigation_ids.push_back(entry->GetUniqueID());
    }
    StartPreview(browser, std::move(tab_ids), std::move(navigation_ids), true);
  }

  void OnPreviewComplete(ai::Submission submission) {
    if (!preview_pending_ || !IsJavascriptAllowed()) {
      return;
    }
    const auto* snapshot =
        std::get_if<std::shared_ptr<const ai::PageContextSnapshot>>(
            &submission.output);
    if (submission.state != ai::ActionState::kCompleted || !snapshot ||
        !*snapshot || !PreviewTabsStillCurrent()) {
      preview_tools_->Stop();
      ClearPreviewState();
      PreviewError("A selected page changed or its context could not be read.");
      return;
    }
    const int count = static_cast<int>(preview_tab_ids_.size());
    if (preview_multiple_) {
      constexpr std::size_t kMaxTextPerTab = 7 * 1024;
      const std::string_view origin =
          base::TruncateUTF8ToByteSize((*snapshot)->origin, 512);
      const std::string_view text = base::TruncateUTF8ToByteSize(
          (*snapshot)->visible_text, kMaxTextPerTab);
      if (!preview_text_.empty()) {
        preview_text_.append("\n\n");
      }
      preview_text_.append("Tab ");
      preview_text_.append(base::NumberToString(preview_index_ + 1));
      preview_text_.append(" · ");
      preview_text_.append(origin);
      preview_text_.append("\n");
      preview_text_.append(text);
      preview_truncated_ |= (*snapshot)->truncated ||
                            origin.size() < (*snapshot)->origin.size() ||
                            text.size() < (*snapshot)->visible_text.size();
    } else {
      preview_text_ = (*snapshot)->visible_text;
      preview_origin_ = (*snapshot)->origin;
      preview_truncated_ = (*snapshot)->truncated;
    }
    ++preview_index_;
    if (preview_index_ < preview_tab_ids_.size()) {
      if (SubmitPreviewTab()) {
        return;
      }
      preview_tools_->Stop();
      ClearPreviewState();
      PreviewError("A selected page could not be read.");
      return;
    }
    preview_tools_->Stop();
    base::DictValue response;
    response.Set("ok", true);
    response.Set("origin",
                 preview_multiple_ ? "Selected tabs" : preview_origin_);
    response.Set("text", preview_text_);
    response.Set("truncated", preview_truncated_);
    response.Set("count", count);
    ClearPreviewState();
    FireWebUIListener("prism-page-preview", response);
  }

  void HandleOpenPanel(const base::ListValue& args) {
    if (!IsJavascriptAllowed() || !args.empty() ||
        web_ui()->GetController()->GetAs<PrismAiPanelUI>()) {
      return;
    }
    Profile* profile = Profile::FromWebUI(web_ui());
    auto* collection = GlobalBrowserCollection::GetInstance();
    BrowserWindowInterface* browser =
        collection ? collection->FindBrowserWithTab(web_ui()->GetWebContents())
                   : nullptr;
    if (!profile || profile->IsOffTheRecord() || !browser ||
        browser->GetProfile() != profile || browser->IsDeleteScheduled()) {
      return;
    }
    if (SidePanelUI* panel = SidePanelUI::From(browser)) {
      const SidePanelEntryKey key(SidePanelEntryId::kPrismAi);
      if (panel->IsSidePanelEntryShowing(key)) {
        panel->Close();
      } else {
        panel->Show(SidePanelEntryId::kPrismAi);
      }
    }
  }

  void HandleReady(const base::ListValue& args) {
    if (!args.empty()) {
      return;
    }
    AllowJavascript();
    if (auto* panel = web_ui()->GetController()->GetAs<PrismAiPanelUI>()) {
      if (panel->embedder()) {
        panel->embedder()->ShowUI();
      }
    }
  }

  void HandleStart(const base::ListValue& args) {
    if (!IsJavascriptAllowed() || args.size() != 3 || !args[0].is_string() ||
        !args[1].is_string() || !args[2].is_bool()) {
      return;
    }
    StartSession(args[0].GetString(), args[1].GetString(), args[2].GetBool());
  }

  void HandleStartSaved(const base::ListValue& args) {
    if (!IsJavascriptAllowed() || args.size() != 1 || !args[0].is_string() ||
        session_) {
      return;
    }
    Profile* profile = Profile::FromWebUI(web_ui());
    if (!profile || profile->IsOffTheRecord()) {
      FireWebUIListener("prism-started", false);
      return;
    }
    credentials::CredentialStore::Load(
        base::BindOnce(&PrismAiMessageHandler::OnCredentialLoaded,
                       weak_factory_.GetWeakPtr(), args[0].GetString()));
  }

  void HandleRemoveKey(const base::ListValue& args) {
    if (!IsJavascriptAllowed() || !args.empty()) {
      return;
    }
    Profile* profile = Profile::FromWebUI(web_ui());
    if (!profile || profile->IsOffTheRecord()) {
      return;
    }
    credentials::CredentialStore::Remove(
        base::BindOnce(&PrismAiMessageHandler::OnCredentialRemoved,
                       weak_factory_.GetWeakPtr()));
  }

  void OnCredentialLoaded(std::string model,
                          credentials::LoadedCredential loaded) {
    if (!IsJavascriptAllowed()) {
      return;
    }
#if !defined(OFFICIAL_BUILD)
    if (loaded.status == credentials::LoadStatus::kNotFound) {
      auto environment = base::Environment::Create();
      if (std::optional<std::string> developer_key =
              environment->GetVar("OPENAI_API_KEY")) {
        loaded = {credentials::LoadStatus::kLoaded, std::move(*developer_key)};
      }
    }
#endif
    if (loaded.status != credentials::LoadStatus::kLoaded) {
      FireWebUIListener("prism-credential",
                        loaded.status == credentials::LoadStatus::kNotFound
                            ? "No saved key was found."
                            : "The system vault is unavailable.");
      return;
    }
    StartSession(std::move(model), std::move(loaded.api_key), false);
  }

  void OnCredentialSaved(bool saved) {
    if (IsJavascriptAllowed()) {
      FireWebUIListener(
          "prism-credential",
          saved ? "Key saved in the system vault."
                : "The key could not be saved in the system vault.");
    }
  }

  void OnCredentialRemoved(bool removed) {
    if (IsJavascriptAllowed()) {
      FireWebUIListener("prism-credential", removed
                                                ? "Saved key removed."
                                                : "No saved key was removed.");
    }
  }

  void StartSession(std::string model, std::string api_key, bool save_key) {
    if (session_) {
      FireWebUIListener("prism-started", false);
      return;
    }
    Profile* profile = Profile::FromWebUI(web_ui());
    auto* collection = GlobalBrowserCollection::GetInstance();
    BrowserWindowInterface* browser =
        webui::GetBrowserWindowInterface(web_ui()->GetWebContents());
    if (!browser && collection) {
      browser = collection->FindBrowserWithTab(web_ui()->GetWebContents());
    }
    if (!profile || profile->IsOffTheRecord() || !browser ||
        browser->GetProfile() != profile || browser->IsDeleteScheduled()) {
      FireWebUIListener("prism-started", false);
      return;
    }
    auto candidate = std::make_unique<ai::AiSessionService>(
        browser->GetWeakPtr(), profile->GetURLLoaderFactory());
    std::string key_to_save = save_key ? api_key : std::string();
    if (!candidate->BeginTask(std::move(model), std::move(api_key))) {
      FireWebUIListener("prism-started", false);
      return;
    }
    session_ = std::move(candidate);
    session_->SetEventObserver(base::BindRepeating(
        &PrismAiMessageHandler::OnSessionEvent, base::Unretained(this)));
    FireWebUIListener("prism-started", true);
    if (save_key) {
      credentials::CredentialStore::Save(
          std::move(key_to_save),
          base::BindOnce(&PrismAiMessageHandler::OnCredentialSaved,
                         weak_factory_.GetWeakPtr()));
    }
  }

  void HandleSend(const base::ListValue& args) {
    if (!session_ || args.size() != 1 || !args[0].is_string()) {
      return;
    }
    if (!session_->SendUserMessage(args[0].GetString())) {
      base::DictValue event;
      event.Set("kind", "error");
      event.Set("text", "The message could not be sent.");
      FireWebUIListener("prism-event", event);
    }
  }

  void HandleGrant(const base::ListValue& args) {
    if (!session_ || args.size() != 2 || !args[0].is_string() ||
        !args[1].is_bool()) {
      return;
    }
    std::optional<ai::Capability> capability =
        CapabilityFromName(args[0].GetString());
    if (!capability) {
      return;
    }
    if (args[1].GetBool()) {
      session_->Grant(*capability);
    } else {
      session_->Revoke(*capability);
    }
  }

  void HandleApprove(const base::ListValue& args) {
    const std::optional<std::uint64_t> id = ActionId(args);
    if (session_ && id) {
      session_->Approve(*id);
    }
  }

  void HandleReject(const base::ListValue& args) {
    const std::optional<std::uint64_t> id = ActionId(args);
    if (session_ && id) {
      session_->Reject(*id);
    }
  }

  void HandleStop(const base::ListValue& args) {
    if (!args.empty()) {
      return;
    }
    StopForPanelHide();
  }

  void HandleAudit(const base::ListValue& args) {
    if (args.empty()) {
      SendAudit();
    }
  }

  std::optional<std::uint64_t> ActionId(const base::ListValue& args) {
    if (args.size() != 1 || !args[0].is_string()) {
      return std::nullopt;
    }
    std::uint64_t id = 0;
    if (!base::StringToUint64(args[0].GetString(), &id) || id == 0) {
      return std::nullopt;
    }
    return id;
  }

  void OnSessionEvent(const ai::AiSessionEvent& session_event) {
    if (!IsJavascriptAllowed()) {
      return;
    }
    base::DictValue event;
    switch (session_event.kind) {
      case ai::AiSessionEventKind::kAssistantText:
        event.Set("kind", "text");
        event.Set("text", session_event.text);
        break;
      case ai::AiSessionEventKind::kToolAction:
        event.Set("kind", "tool");
        break;
      case ai::AiSessionEventKind::kApprovalRequired:
        event.Set("kind", "approval");
        event.Set("action_id", base::NumberToString(session_event.action_id));
        event.Set("details", session_event.approval_call
                                 ? ApprovalDetails(*session_event.approval_call)
                                 : "Review this browser action.");
        break;
      case ai::AiSessionEventKind::kReady:
        event.Set("kind", "ready");
        break;
      case ai::AiSessionEventKind::kError:
        event.Set("kind", "error");
        event.Set("text", session_event.text);
        break;
      case ai::AiSessionEventKind::kStopped:
        event.Set("kind", "stopped");
        break;
    }
    FireWebUIListener("prism-event", event);
    SendAudit();
    if (session_event.kind == ai::AiSessionEventKind::kStopped) {
      base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
          FROM_HERE, base::BindOnce(&PrismAiMessageHandler::ResetSession,
                                    weak_factory_.GetWeakPtr()));
    }
  }

  void ResetSession() { session_.reset(); }

  void SendAudit() {
    if (!IsJavascriptAllowed()) {
      return;
    }
    base::ListValue entries;
    if (session_) {
      const std::vector<ai::AuditEntry> audit = session_->AuditSnapshot();
      const std::size_t start = audit.size() > 100 ? audit.size() - 100 : 0;
      for (std::size_t index = start; index < audit.size(); ++index) {
        base::DictValue entry;
        entry.Set("id", base::NumberToString(audit[index].action_id));
        entry.Set("tool", audit[index].tool_name);
        entry.Set("state", static_cast<int>(audit[index].state));
        entry.Set("reason", static_cast<int>(audit[index].reason));
        entries.Append(std::move(entry));
      }
    }
    FireWebUIListener("prism-audit", entries);
  }

  std::unique_ptr<ai::AiSessionService> session_;
  std::unique_ptr<ai::ChromiumBrowserToolService> preview_tools_;
  bool preview_pending_ = false;
  bool preview_multiple_ = false;
  bool preview_truncated_ = false;
  std::size_t preview_index_ = 0;
  std::vector<int> preview_tab_ids_;
  std::vector<int> preview_navigation_ids_;
  std::string preview_text_;
  std::string preview_origin_;
  base::WeakPtr<BrowserWindowInterface> preview_browser_;
  base::WeakPtrFactory<PrismAiMessageHandler> weak_factory_{this};
};

base::WeakPtr<PrismAiMessageHandler> AddPrismAiResources(content::WebUI* web_ui,
                                                         const char* host) {
  content::WebUIDataSource* source =
      content::WebUIDataSource::CreateAndAdd(Profile::FromWebUI(web_ui), host);
  source->SetRequestFilter(base::BindRepeating(&HasPrismResource),
                           base::BindRepeating(&ServePrismResource));
  auto handler = std::make_unique<PrismAiMessageHandler>();
  base::WeakPtr<PrismAiMessageHandler> result = handler->GetWeakPtr();
  web_ui->AddMessageHandler(std::move(handler));
  return result;
}

PrismAiUI::PrismAiUI(content::WebUI* web_ui) : WebUIController(web_ui) {
  AddPrismAiResources(web_ui, kPrismAiHost);
}

PrismAiUI::~PrismAiUI() = default;

WEB_UI_CONTROLLER_TYPE_IMPL(PrismAiUI)

PrismAiPanelUI::PrismAiPanelUI(content::WebUI* web_ui)
    : TopChromeWebUIController(web_ui, /*enable_chrome_send=*/true),
      WebContentsObserver(web_ui->GetWebContents()) {
  handler_ = AddPrismAiResources(web_ui, kPrismAiPanelHost);
}

PrismAiPanelUI::~PrismAiPanelUI() = default;

void PrismAiPanelUI::OnVisibilityChanged(content::Visibility visibility) {
  if (visibility != content::Visibility::VISIBLE && handler_) {
    handler_->StopForPanelHide();
  }
}

WEB_UI_CONTROLLER_TYPE_IMPL(PrismAiPanelUI)

}  // namespace prism::ui
