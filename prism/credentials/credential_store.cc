#include "prism/credentials/credential_store.h"

#include <utility>

#include "base/functional/bind.h"
#include "base/location.h"
#include "base/task/task_traits.h"
#include "base/task/thread_pool.h"
#include "prism/credentials/credential_store_platform.h"

namespace prism::credentials {

void CredentialStore::Save(std::string api_key, SaveCallback callback) {
  if (api_key.empty() || api_key.size() > 1024 ||
      api_key.find('\0') != std::string::npos) {
    std::move(callback).Run(false);
    return;
  }
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
      base::BindOnce(&SaveOnWorker, std::move(api_key)), std::move(callback));
}

void CredentialStore::Load(LoadCallback callback) {
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
      base::BindOnce(&LoadOnWorker), std::move(callback));
}

void CredentialStore::Remove(SaveCallback callback) {
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
      base::BindOnce(&RemoveOnWorker), std::move(callback));
}

}  // namespace prism::credentials
