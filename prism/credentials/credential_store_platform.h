#ifndef PRISM_CREDENTIALS_CREDENTIAL_STORE_PLATFORM_H_
#define PRISM_CREDENTIALS_CREDENTIAL_STORE_PLATFORM_H_

#include <string>

#include "prism/credentials/credential_store.h"

namespace prism::credentials {

bool SaveOnWorker(std::string api_key);
LoadedCredential LoadOnWorker();
bool RemoveOnWorker();

}  // namespace prism::credentials

#endif  // PRISM_CREDENTIALS_CREDENTIAL_STORE_PLATFORM_H_
