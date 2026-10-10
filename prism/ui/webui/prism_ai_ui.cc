#include "prism/ui/webui/prism_ai_ui.h"

#include <algorithm>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <utility>

#include "base/environment.h"
#include "base/functional/bind.h"
#include "base/location.h"
#include "base/memory/ref_counted_memory.h"
#include "base/memory/weak_ptr.h"
#include "base/strings/string_number_conversions.h"
#include "base/task/sequenced_task_runner.h"
#include "base/values.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/global_browser_collection.h"
#include "chrome/browser/ui/side_panel/side_panel_ui.h"
#include "chrome/browser/ui/webui/webui_embedding_context.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "content/public/browser/web_ui_message_handler.h"
#include "prism/ai/ai_session_service.h"
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
  }

  void OnJavascriptDisallowed() override {
    weak_factory_.InvalidateWeakPtrs();
    session_.reset();
  }

 private:
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
