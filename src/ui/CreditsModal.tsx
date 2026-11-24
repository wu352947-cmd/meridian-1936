import { useEffect, useState } from 'preact/hooks';

interface AssetLicenseEntry {
  assetId: string;
  files: string[];
  title: string;
  author: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  modifications?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreditsModal({ open, onClose }: Props) {
  const [entries, setEntries] = useState<AssetLicenseEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || entries.length > 0) return;
    fetch(`${import.meta.env.BASE_URL}assets/ASSET_LICENSES.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<AssetLicenseEntry[]>;
      })
      .then(setEntries)
      .catch((e) => setError(String(e)));
  }, [open, entries.length]);

  if (!open) return null;

  return (
    <div class="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="关于与开源致谢">
      <div class="credits-modal" onClick={(e) => e.stopPropagation()}>
        <div class="credits-head">
          <h2>关于《子午线 1936》与开源素材致谢</h2>
          <button type="button" class="staff-btn" onClick={onClose}>
            关闭
          </button>
        </div>

        <div class="credits-body">
          <div class="credits-note">
            <strong>原创声明与合规说明：</strong>
            本作《子午线 1936：碎裂大陆》（Meridian 1936）为原创 2D 历史战略地图工程，采用“1936 参谋部亚麻制图与电报档案”原创美术语言。全部国家旗帜均采用中性合规几何矢量方案，严禁任何违禁极端符号。地图边界基于公有领域 Natural Earth 离线重投影并按 1936 年历史版图清洁重构。
          </div>

          {error && <p style="color:#B83A2D;">许可清单加载失败：{error}</p>}

          {entries.map((item) => (
            <div class="license-item" key={item.assetId}>
              <div class="license-top">
                <span class="license-title">{item.title}</span>
                <a class="license-tag" href={item.licenseUrl} target="_blank" rel="noreferrer">
                  {item.license}
                </a>
              </div>
              <div class="license-meta">
                作者：{item.author} · 来源：
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  {item.sourceUrl}
                </a>
              </div>
              {item.modifications && (
                <div class="license-meta">改编说明：{item.modifications}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
