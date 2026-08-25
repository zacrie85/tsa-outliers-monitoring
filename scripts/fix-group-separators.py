import re

filepath = '/home/z/my-project/src/components/pivot/excel-pivot-table.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# === 1. Add useMemo for group metadata computation ===
# Insert after the `hasData` line
old_hasData = '  const hasData = pivotResult.dataRows.length > 0;'
new_hasData = '''  const hasData = pivotResult.dataRows.length > 0;

  // Compute group metadata for visual separators
  const groupMeta = useMemo(() => {
    const colors = [
      { bg: 'rgba(100,181,246,0.06)', border: 'rgba(100,181,246,0.25)', text: '#64b5f6', dot: '#64b5f6' },
      { bg: 'rgba(186,104,200,0.06)', border: 'rgba(186,104,200,0.25)', text: '#ba68c8', dot: '#ba68c8' },
      { bg: 'rgba(102,187,106,0.06)', border: 'rgba(102,187,106,0.25)', text: '#66bb6a', dot: '#66bb6a' },
      { bg: 'rgba(255,183,77,0.06)', border: 'rgba(255,183,77,0.25)', text: '#ffb74d', dot: '#ffb74d' },
      { bg: 'rgba(77,208,225,0.06)', border: 'rgba(77,208,225,0.25)', text: '#4dd0e1', dot: '#4dd0e1' },
      { bg: 'rgba(239,83,80,0.06)', border: 'rgba(239,83,80,0.25)', text: '#ef5350', dot: '#ef5350' },
      { bg: 'rgba(255,138,101,0.06)', border: 'rgba(255,138,101,0.25)', text: '#ff8a65', dot: '#ff8a65' },
      { bg: 'rgba(129,199,132,0.06)', border: 'rgba(129,199,132,0.25)', text: '#81c784', dot: '#81c784' },
    ];
    const result: { groupIndex: number; groupLabel: string; isGroupStart: boolean; color: typeof colors[0] }[] = [];
    let currentGroup = -1;
    let lastFirstSegment = '';
    for (const dr of pivotResult.dataRows) {
      if (dr.isTotal) {
        result.push({ groupIndex: -1, groupLabel: '', isGroupStart: false, color: colors[0] });
        continue;
      }
      const segments = dr.label.split(' | ');
      const firstSeg = segments[0] || dr.label;
      if (firstSeg !== lastFirstSegment) {
        currentGroup++;
        lastFirstSegment = firstSeg;
      }
      result.push({
        groupIndex: currentGroup,
        groupLabel: firstSeg,
        isGroupStart: result.length === 0 || (result.length > 0 && pivotResult.dataRows[result.length - 1]?.label.split(' | ')[0] !== firstSeg && !pivotResult.dataRows[result.length - 1]?.isTotal),
        color: colors[currentGroup % colors.length],
      });
    }
    return result;
  }, [pivotResult.dataRows]);'''

content = content.replace(old_hasData, new_hasData)

# === 2. Replace the tbody rendering ===
old_tbody = '''                <tbody>
                  {pivotResult.dataRows.map((dr, ri) => (
                    <tr key={ri} className={`${dr.isTotal ? 'border-t-2 border-white/10 bg-white/[0.04]' : ri % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                      <td className={`px-3 py-2 whitespace-nowrap sticky left-0 z-10 ${dr.isTotal ? 'text-white font-bold' : 'text-[#e0e0e0] font-medium'}`}
                        style={{ background: dr.isTotal ? '#ffffff0a' : (ri % 2 === 0 ? '#ffffff06' : '#ffffff03'), backdropFilter: 'blur(8px)' }}>
                        {dr.isTotal && <span className="mr-1.5 text-[#4dd0e1]">&#931;</span>}
                        {dr.label}
                      </td>
                      {dr.values.map((v, vi) => (
                        <td key={vi} className={`text-center px-3 py-2 font-mono whitespace-nowrap ${
                          dr.isTotal ? 'font-bold text-white' : v > 0 ? 'text-[#e0e0e0]' : 'text-[#37474f]'
                        }`}>
                          {v.toLocaleString('id-ID')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>'''

new_tbody = '''                <tbody>
                  {pivotResult.dataRows.map((dr, ri) => {
                    const meta = groupMeta[ri];
                    const showGroupHeader = meta.isGroupStart && rowFields.length > 1;
                    return (
                      <Fragment key={ri}>
                        {/* Group separator header row */}
                        {showGroupHeader && (
                          <tr>
                            <td colSpan={pivotResult.headers.length}
                              className="px-3 py-1.5"
                              style={{ background: `${meta.color.border}15`, borderTop: `2px solid ${meta.color.border}` }}>
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color.dot }} />
                                <span className="text-[10px] font-bold tracking-wide" style={{ color: meta.color.text }}>
                                  {meta.groupLabel}
                                </span>
                                <div className="flex-1 h-px" style={{ background: `${meta.color.border}40` }} />
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* Data row */}
                        <tr className={dr.isTotal ? 'border-t-2 border-white/10' : ''}
                          style={!dr.isTotal ? { background: meta.color.bg } : { background: '#ffffff0a' }}>
                          <td className={`px-3 py-2 whitespace-nowrap sticky left-0 z-10 ${dr.isTotal ? 'text-white font-bold' : 'text-[#e0e0e0] font-medium'}`}
                            style={{
                              background: dr.isTotal ? '#ffffff0a' : meta.color.bg,
                              backdropFilter: 'blur(8px)',
                              borderLeft: !dr.isTotal && rowFields.length > 1 ? `3px solid ${meta.color.border}` : 'none',
                            }}>
                            {dr.isTotal && <span className="mr-1.5 text-[#4dd0e1]">&#931;</span>}
                            {dr.label}
                          </td>
                          {dr.values.map((v, vi) => (
                            <td key={vi} className={`text-center px-3 py-2 font-mono whitespace-nowrap ${
                              dr.isTotal ? 'font-bold text-white' : v > 0 ? 'text-[#e0e0e0]' : 'text-[#37474f]'
                            }`}
                              style={!dr.isTotal ? { background: meta.color.bg } : {}}>
                              {v.toLocaleString('id-ID')}
                            </td>
                          ))}
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>'''

content = content.replace(old_tbody, new_tbody)

# === 3. Add Fragment to React imports ===
content = content.replace(
    'import { useState, useCallback, useEffect, useMemo, useRef } from \'react\';',
    'import { useState, useCallback, useEffect, useMemo, useRef, Fragment } from \'react\';'
)

with open(filepath, 'w') as f:
    f.write(content)

print('Done! Group separators added.')