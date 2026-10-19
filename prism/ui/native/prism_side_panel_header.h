#ifndef PRISM_UI_NATIVE_PRISM_SIDE_PANEL_HEADER_H_
#define PRISM_UI_NATIVE_PRISM_SIDE_PANEL_HEADER_H_

#include <memory>

#include "chrome/browser/ui/views/side_panel/side_panel_header.h"

// The AI panel's native material frame; SidePanelHeader retains its layout.
class PrismSidePanelHeader : public SidePanelHeader {
  METADATA_HEADER(PrismSidePanelHeader, SidePanelHeader)

public:
  explicit PrismSidePanelHeader(std::unique_ptr<Delegate> delegate);
  PrismSidePanelHeader(const PrismSidePanelHeader &) = delete;
  PrismSidePanelHeader &operator=(const PrismSidePanelHeader &) = delete;
  ~PrismSidePanelHeader() override;

protected:
  void OnPaintBackground(gfx::Canvas *canvas) override;
};

#endif // PRISM_UI_NATIVE_PRISM_SIDE_PANEL_HEADER_H_
