use napi_derive::napi;

use crate::{
  error::{BindingCompatibilityError, BindingConversionError},
  numeric::js_number_from_usize,
};

type ConversionResult<T> = std::result::Result<T, BindingConversionError>;

/// The extraction strategy selected by Legible.
#[napi(string_enum = "camelCase")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExtractionStrategy {
  Normal,
  RelaxedCleanup,
  BroadContent,
  StructuredDataHint,
  RelaxedVisibility,
  BodyFallback,
  MetadataFallback,
}

impl TryFrom<legible_upstream::ExtractionStrategyInfo> for ExtractionStrategy {
  type Error = BindingCompatibilityError;

  fn try_from(value: legible_upstream::ExtractionStrategyInfo) -> Result<Self, Self::Error> {
    match value {
      legible_upstream::ExtractionStrategyInfo::Normal => Ok(Self::Normal),
      legible_upstream::ExtractionStrategyInfo::RelaxedCleanup => Ok(Self::RelaxedCleanup),
      legible_upstream::ExtractionStrategyInfo::BroadContent => Ok(Self::BroadContent),
      legible_upstream::ExtractionStrategyInfo::StructuredDataHint => Ok(Self::StructuredDataHint),
      legible_upstream::ExtractionStrategyInfo::RelaxedVisibility => Ok(Self::RelaxedVisibility),
      legible_upstream::ExtractionStrategyInfo::BodyFallback => Ok(Self::BodyFallback),
      legible_upstream::ExtractionStrategyInfo::MetadataFallback => Ok(Self::MetadataFallback),
      _ => Err(BindingCompatibilityError::new(
        "unsupported Legible extraction strategy variant",
      )),
    }
  }
}

/// Why Legible selected an extraction root.
#[napi(string_enum = "camelCase")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RootSelectionReason {
  Ranked,
  SpecificChild,
  SharedParent,
  CompleteAncestor,
  StructuredData,
  ArticleBody,
  BodyFallback,
  MetadataFallback,
}

impl TryFrom<legible_upstream::RootSelectionReasonInfo> for RootSelectionReason {
  type Error = BindingCompatibilityError;

  fn try_from(value: legible_upstream::RootSelectionReasonInfo) -> Result<Self, Self::Error> {
    match value {
      legible_upstream::RootSelectionReasonInfo::Ranked => Ok(Self::Ranked),
      legible_upstream::RootSelectionReasonInfo::SpecificChild => Ok(Self::SpecificChild),
      legible_upstream::RootSelectionReasonInfo::SharedParent => Ok(Self::SharedParent),
      legible_upstream::RootSelectionReasonInfo::CompleteAncestor => Ok(Self::CompleteAncestor),
      legible_upstream::RootSelectionReasonInfo::StructuredData => Ok(Self::StructuredData),
      legible_upstream::RootSelectionReasonInfo::ArticleBody => Ok(Self::ArticleBody),
      legible_upstream::RootSelectionReasonInfo::BodyFallback => Ok(Self::BodyFallback),
      legible_upstream::RootSelectionReasonInfo::MetadataFallback => Ok(Self::MetadataFallback),
      _ => Err(BindingCompatibilityError::new(
        "unsupported Legible root selection reason variant",
      )),
    }
  }
}

/// Evidence source for a selected extraction root.
#[napi(string_enum = "camelCase")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CandidateSource {
  Semantic,
  Readability,
  StructuredData,
  Generic,
  CallerHint,
}

impl TryFrom<legible_upstream::CandidateSourceInfo> for CandidateSource {
  type Error = BindingCompatibilityError;

  fn try_from(value: legible_upstream::CandidateSourceInfo) -> Result<Self, Self::Error> {
    match value {
      legible_upstream::CandidateSourceInfo::Semantic => Ok(Self::Semantic),
      legible_upstream::CandidateSourceInfo::Readability => Ok(Self::Readability),
      legible_upstream::CandidateSourceInfo::StructuredData => Ok(Self::StructuredData),
      legible_upstream::CandidateSourceInfo::Generic => Ok(Self::Generic),
      legible_upstream::CandidateSourceInfo::CallerHint => Ok(Self::CallerHint),
      _ => Err(BindingCompatibilityError::new(
        "unsupported Legible candidate source variant",
      )),
    }
  }
}

/// Measurements for a source or result region.
#[napi(object, object_from_js = false)]
#[derive(Debug, Clone)]
pub struct ContentMetrics {
  pub word_count: f64,
  pub text_chars: f64,
  pub link_text_chars: f64,
  pub paragraph_count: f64,
  pub heading_count: f64,
  pub list_item_count: f64,
  pub code_block_count: f64,
  pub table_count: f64,
  pub figure_count: f64,
  pub image_count: f64,
  pub footnote_reference_count: f64,
  pub footnote_definition_count: f64,
  pub math_count: f64,
  pub structured_block_count: f64,
  pub link_density: f64,
}

impl ContentMetrics {
  fn from_upstream(value: &legible_upstream::ContentMetricsInfo) -> ConversionResult<Self> {
    Ok(Self {
      word_count: js_number_from_usize("wordCount", value.word_count)?,
      text_chars: js_number_from_usize("textChars", value.text_chars)?,
      link_text_chars: js_number_from_usize("linkTextChars", value.link_text_chars)?,
      paragraph_count: js_number_from_usize("paragraphCount", value.paragraph_count)?,
      heading_count: js_number_from_usize("headingCount", value.heading_count)?,
      list_item_count: js_number_from_usize("listItemCount", value.list_item_count)?,
      code_block_count: js_number_from_usize("codeBlockCount", value.code_block_count)?,
      table_count: js_number_from_usize("tableCount", value.table_count)?,
      figure_count: js_number_from_usize("figureCount", value.figure_count)?,
      image_count: js_number_from_usize("imageCount", value.image_count)?,
      footnote_reference_count: js_number_from_usize(
        "footnoteReferenceCount",
        value.footnote_reference_count,
      )?,
      footnote_definition_count: js_number_from_usize(
        "footnoteDefinitionCount",
        value.footnote_definition_count,
      )?,
      math_count: js_number_from_usize("mathCount", value.math_count)?,
      structured_block_count: js_number_from_usize(
        "structuredBlockCount",
        value.structured_block_count,
      )?,
      link_density: value.link_density,
    })
  }
}

/// Quality measurements for one extraction attempt.
#[napi(object, object_from_js = false)]
#[derive(Debug, Clone)]
pub struct QualityInfo {
  pub coverage: f64,
  pub best_attempt_score: f64,
  pub good: bool,
  pub suspiciously_small: bool,
}

impl From<&legible_upstream::QualityInfo> for QualityInfo {
  fn from(value: &legible_upstream::QualityInfo) -> Self {
    Self {
      coverage: value.coverage,
      best_attempt_score: value.best_attempt_score,
      good: value.good,
      suspiciously_small: value.suspiciously_small,
    }
  }
}

/// A category used for source-to-result semantic coverage.
#[napi(string_enum = "camelCase")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SemanticCoverageCategory {
  CodeBlocks,
  DataTables,
  SubstantialListItems,
  Visuals,
  Headings,
  FootnoteDefinitions,
  MathExpressions,
}

impl TryFrom<legible_upstream::SemanticCoverageCategory> for SemanticCoverageCategory {
  type Error = BindingCompatibilityError;

  fn try_from(value: legible_upstream::SemanticCoverageCategory) -> Result<Self, Self::Error> {
    match value {
      legible_upstream::SemanticCoverageCategory::CodeBlocks => Ok(Self::CodeBlocks),
      legible_upstream::SemanticCoverageCategory::DataTables => Ok(Self::DataTables),
      legible_upstream::SemanticCoverageCategory::SubstantialListItems => {
        Ok(Self::SubstantialListItems)
      }
      legible_upstream::SemanticCoverageCategory::Visuals => Ok(Self::Visuals),
      legible_upstream::SemanticCoverageCategory::Headings => Ok(Self::Headings),
      legible_upstream::SemanticCoverageCategory::FootnoteDefinitions => {
        Ok(Self::FootnoteDefinitions)
      }
      legible_upstream::SemanticCoverageCategory::MathExpressions => Ok(Self::MathExpressions),
      _ => Err(BindingCompatibilityError::new(
        "unsupported Legible semantic coverage category variant",
      )),
    }
  }
}

/// Coverage for one semantic structure category.
#[napi(object, object_from_js = false)]
#[derive(Debug, Clone)]
pub struct SemanticCategoryCoverage {
  pub category: SemanticCoverageCategory,
  pub source_count: f64,
  pub result_count: f64,
  pub coverage: f64,
}

impl SemanticCategoryCoverage {
  fn from_upstream(
    value: &legible_upstream::SemanticCategoryCoverageInfo,
  ) -> ConversionResult<Self> {
    Ok(Self {
      category: value.category.try_into()?,
      source_count: js_number_from_usize("sourceCount", value.source_count)?,
      result_count: js_number_from_usize("resultCount", value.result_count)?,
      coverage: value.coverage,
    })
  }
}

/// Source-to-result coverage across eligible semantic structures.
#[napi(object, object_from_js = false)]
#[derive(Debug, Clone)]
pub struct SemanticCoverage {
  pub score: f64,
  pub categories: Vec<SemanticCategoryCoverage>,
}

impl SemanticCoverage {
  fn from_upstream(value: &legible_upstream::SemanticCoverageInfo) -> ConversionResult<Self> {
    Ok(Self {
      score: value.score,
      categories: value
        .categories
        .iter()
        .map(SemanticCategoryCoverage::from_upstream)
        .collect::<ConversionResult<Vec<_>>>()?,
    })
  }
}

/// Why an extraction attempt was rejected.
#[napi(string_enum = "camelCase")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttemptRejectionReason {
  DocumentChrome,
  AccessBarrier,
  SourceAccessBarrier,
  InteractiveShell,
  LinkOnlySemanticRoot,
  IncoherentShortResult,
  LowQuality,
  PotentialHiddenContent,
  InsufficientImprovement,
  Superseded,
}

impl TryFrom<legible_upstream::AttemptRejectionReason> for AttemptRejectionReason {
  type Error = BindingCompatibilityError;

  fn try_from(value: legible_upstream::AttemptRejectionReason) -> Result<Self, Self::Error> {
    match value {
      legible_upstream::AttemptRejectionReason::DocumentChrome => Ok(Self::DocumentChrome),
      legible_upstream::AttemptRejectionReason::AccessBarrier => Ok(Self::AccessBarrier),
      legible_upstream::AttemptRejectionReason::SourceAccessBarrier => {
        Ok(Self::SourceAccessBarrier)
      }
      legible_upstream::AttemptRejectionReason::InteractiveShell => Ok(Self::InteractiveShell),
      legible_upstream::AttemptRejectionReason::LinkOnlySemanticRoot => {
        Ok(Self::LinkOnlySemanticRoot)
      }
      legible_upstream::AttemptRejectionReason::IncoherentShortResult => {
        Ok(Self::IncoherentShortResult)
      }
      legible_upstream::AttemptRejectionReason::LowQuality => Ok(Self::LowQuality),
      legible_upstream::AttemptRejectionReason::PotentialHiddenContent => {
        Ok(Self::PotentialHiddenContent)
      }
      legible_upstream::AttemptRejectionReason::InsufficientImprovement => {
        Ok(Self::InsufficientImprovement)
      }
      legible_upstream::AttemptRejectionReason::Superseded => Ok(Self::Superseded),
      _ => Err(BindingCompatibilityError::new(
        "unsupported Legible attempt rejection reason variant",
      )),
    }
  }
}

/// A positive exception that allowed an attempt to be accepted.
#[napi(string_enum = "camelCase")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AcceptanceException {
  TrustedSemanticRoot,
}

impl TryFrom<legible_upstream::AcceptanceExceptionInfo> for AcceptanceException {
  type Error = BindingCompatibilityError;

  fn try_from(value: legible_upstream::AcceptanceExceptionInfo) -> Result<Self, Self::Error> {
    match value {
      legible_upstream::AcceptanceExceptionInfo::TrustedSemanticRoot => {
        Ok(Self::TrustedSemanticRoot)
      }
      _ => Err(BindingCompatibilityError::new(
        "unsupported Legible acceptance exception variant",
      )),
    }
  }
}

/// A major cleanup stage.
#[napi(string_enum = "camelCase")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CleanupActionKind {
  DecorativeMedia,
  HardCleanup,
  HeuristicCleanup,
  FinalCleanup,
}

impl TryFrom<legible_upstream::CleanupActionKind> for CleanupActionKind {
  type Error = BindingCompatibilityError;

  fn try_from(value: legible_upstream::CleanupActionKind) -> Result<Self, Self::Error> {
    match value {
      legible_upstream::CleanupActionKind::DecorativeMedia => Ok(Self::DecorativeMedia),
      legible_upstream::CleanupActionKind::HardCleanup => Ok(Self::HardCleanup),
      legible_upstream::CleanupActionKind::HeuristicCleanup => Ok(Self::HeuristicCleanup),
      legible_upstream::CleanupActionKind::FinalCleanup => Ok(Self::FinalCleanup),
      _ => Err(BindingCompatibilityError::new(
        "unsupported Legible cleanup action variant",
      )),
    }
  }
}

/// A cleanup stage and the number of elements it removed.
#[napi(object, object_from_js = false)]
#[derive(Debug, Clone)]
pub struct CleanupAction {
  pub kind: CleanupActionKind,
  pub removed_elements: f64,
}

impl CleanupAction {
  fn from_upstream(value: &legible_upstream::CleanupActionInfo) -> ConversionResult<Self> {
    Ok(Self {
      kind: value.kind.try_into()?,
      removed_elements: js_number_from_usize("removedElements", value.removed_elements)?,
    })
  }
}

/// Counts of structures produced by semantic normalization.
#[napi(object, object_from_js = false)]
#[derive(Debug, Clone)]
pub struct NormalizationCounts {
  pub code_blocks: f64,
  pub footnote_references: f64,
  pub footnote_definitions: f64,
  pub math_expressions: f64,
  pub images: f64,
  pub tables: f64,
  pub flattened_layout_tables: f64,
}

impl NormalizationCounts {
  fn from_upstream(value: &legible_upstream::NormalizationCountsInfo) -> ConversionResult<Self> {
    Ok(Self {
      code_blocks: js_number_from_usize("codeBlocks", value.code_blocks)?,
      footnote_references: js_number_from_usize("footnoteReferences", value.footnote_references)?,
      footnote_definitions: js_number_from_usize(
        "footnoteDefinitions",
        value.footnote_definitions,
      )?,
      math_expressions: js_number_from_usize("mathExpressions", value.math_expressions)?,
      images: js_number_from_usize("images", value.images)?,
      tables: js_number_from_usize("tables", value.tables)?,
      flattened_layout_tables: js_number_from_usize(
        "flattenedLayoutTables",
        value.flattened_layout_tables,
      )?,
    })
  }
}

/// Size measurements for the retained representation.
#[napi(object, object_from_js = false)]
#[derive(Debug, Clone)]
pub struct RepresentationMetrics {
  pub source_dom_nodes: f64,
  pub final_dom_nodes: f64,
  pub document_nodes: f64,
  pub estimated_document_bytes: f64,
}

impl RepresentationMetrics {
  fn from_upstream(value: &legible_upstream::RepresentationMetricsInfo) -> ConversionResult<Self> {
    Ok(Self {
      source_dom_nodes: js_number_from_usize("sourceDomNodes", value.source_dom_nodes)?,
      final_dom_nodes: js_number_from_usize("finalDomNodes", value.final_dom_nodes)?,
      document_nodes: js_number_from_usize("documentNodes", value.document_nodes)?,
      estimated_document_bytes: js_number_from_usize(
        "estimatedDocumentBytes",
        value.estimated_document_bytes,
      )?,
    })
  }
}

/// One attempt made by Legible while selecting and cleaning content.
#[napi(object, object_from_js = false, use_nullable = true)]
#[derive(Debug, Clone)]
pub struct ExtractionAttempt {
  pub strategy: ExtractionStrategy,
  pub selected_root: RootInfo,
  pub source: ContentMetrics,
  pub result: ContentMetrics,
  pub quality: QualityInfo,
  pub semantic_coverage: Option<SemanticCoverage>,
  pub cleanup_actions: Vec<CleanupAction>,
  pub normalization: NormalizationCounts,
  pub representation: RepresentationMetrics,
  pub accepted: bool,
  pub acceptance_exception: Option<AcceptanceException>,
  pub rejection_reason: Option<AttemptRejectionReason>,
}

impl ExtractionAttempt {
  fn from_upstream(value: &legible_upstream::ExtractionAttempt) -> ConversionResult<Self> {
    Ok(Self {
      strategy: value.strategy.try_into()?,
      selected_root: RootInfo::from_upstream(&value.selected_root)?,
      source: ContentMetrics::from_upstream(&value.source)?,
      result: ContentMetrics::from_upstream(&value.result)?,
      quality: (&value.quality).into(),
      semantic_coverage: value
        .semantic_coverage
        .as_ref()
        .map(SemanticCoverage::from_upstream)
        .transpose()?,
      cleanup_actions: value
        .cleanup_actions
        .iter()
        .map(CleanupAction::from_upstream)
        .collect::<ConversionResult<Vec<_>>>()?,
      normalization: NormalizationCounts::from_upstream(&value.normalization)?,
      representation: RepresentationMetrics::from_upstream(&value.representation)?,
      accepted: value.accepted,
      acceptance_exception: value
        .acceptance_exception
        .map(TryInto::try_into)
        .transpose()?,
      rejection_reason: value.rejection_reason.map(TryInto::try_into).transpose()?,
    })
  }
}

/// Structured information about the extraction decision.
#[napi(object, object_from_js = false, use_nullable = true)]
#[derive(Debug, Clone)]
pub struct ExtractionDiagnostics {
  pub selected_strategy: ExtractionStrategy,
  pub specialized_extractor: Option<String>,
  pub attempts: Vec<ExtractionAttempt>,
}

impl ExtractionDiagnostics {
  pub(crate) fn from_upstream(
    value: &legible_upstream::ExtractionDiagnostics,
  ) -> ConversionResult<Self> {
    Ok(Self {
      selected_strategy: value.selected_strategy.try_into()?,
      specialized_extractor: value.specialized_extractor.clone(),
      attempts: value
        .attempts
        .iter()
        .map(ExtractionAttempt::from_upstream)
        .collect::<ConversionResult<Vec<_>>>()?,
    })
  }
}

/// A stable description of the selected extraction root.
#[napi(object, object_from_js = false, use_nullable = true)]
#[derive(Debug, Clone)]
pub struct RootInfo {
  pub tag: Option<String>,
  pub id: Option<String>,
  pub classes: Vec<String>,
  pub selection_reason: RootSelectionReason,
  pub candidate_sources: Vec<CandidateSource>,
}

impl RootInfo {
  fn from_upstream(value: &legible_upstream::RootInfo) -> ConversionResult<Self> {
    Ok(Self {
      tag: value.tag.clone(),
      id: value.id.clone(),
      classes: value.classes.clone(),
      selection_reason: value.selection_reason.try_into()?,
      candidate_sources: value
        .candidate_sources
        .iter()
        .copied()
        .map(|source| source.try_into().map_err(BindingConversionError::from))
        .collect::<ConversionResult<Vec<_>>>()?,
    })
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn converts_all_diagnostic_enum_variants() {
    assert_eq!(
      ExtractionStrategy::try_from(legible_upstream::ExtractionStrategyInfo::Normal).unwrap(),
      ExtractionStrategy::Normal
    );
    assert_eq!(
      RootSelectionReason::try_from(legible_upstream::RootSelectionReasonInfo::SpecificChild)
        .unwrap(),
      RootSelectionReason::SpecificChild
    );
    assert_eq!(
      CandidateSource::try_from(legible_upstream::CandidateSourceInfo::CallerHint).unwrap(),
      CandidateSource::CallerHint
    );
    assert_eq!(
      SemanticCoverageCategory::try_from(
        legible_upstream::SemanticCoverageCategory::MathExpressions,
      )
      .unwrap(),
      SemanticCoverageCategory::MathExpressions
    );
    assert_eq!(
      AttemptRejectionReason::try_from(
        legible_upstream::AttemptRejectionReason::InsufficientImprovement,
      )
      .unwrap(),
      AttemptRejectionReason::InsufficientImprovement
    );
    assert_eq!(
      AcceptanceException::try_from(
        legible_upstream::AcceptanceExceptionInfo::TrustedSemanticRoot,
      )
      .unwrap(),
      AcceptanceException::TrustedSemanticRoot
    );
    assert_eq!(
      CleanupActionKind::try_from(legible_upstream::CleanupActionKind::HeuristicCleanup).unwrap(),
      CleanupActionKind::HeuristicCleanup
    );
  }

  #[test]
  fn converts_diagnostics_from_an_upstream_page() {
    let html = r#"<html><head><title>Diagnostic page</title></head><body><main><h1>Diagnostic page</h1><p>This page has enough meaningful content for extraction and provides clear details and useful context for every reader.</p><p>A second paragraph keeps the diagnostic result substantial and deterministic.</p></main></body></html>"#;
    let page = legible_upstream::Extractor::builder()
      .diagnostics(true)
      .build()
      .extract(html, None)
      .unwrap();
    let upstream = page.diagnostics().expect("diagnostics were enabled");

    let diagnostics = ExtractionDiagnostics::from_upstream(upstream).unwrap();
    assert!(!diagnostics.attempts.is_empty());
    assert_eq!(diagnostics.specialized_extractor, None);
    assert!(diagnostics.attempts[0].quality.good);
    assert!(diagnostics.attempts[0].source.word_count > 0.0);
  }
}
