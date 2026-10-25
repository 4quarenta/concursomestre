<?php
declare(strict_types=1);

/** Reject unsafe input rather than silently changing scientific content. */
final class CmBatchHtmlPolicy
{
    public static function assertSafe(string $html, array $mediaUrls = []): void
    {
        if (strlen($html)>2*1024*1024) throw new InvalidArgumentException('Fragmento HTML acima do limite.');
        $document=new DOMDocument('1.0','UTF-8');
        $previous=libxml_use_internal_errors(true);
        try {
            $document->loadHTML('<?xml encoding="UTF-8"><html><body>'.$html.'</body></html>',LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
            $allowed=['html','body','p','div','span','br','strong','b','em','i','u','s','sup','sub','ul','ol','li','blockquote','table','thead','tbody','tfoot','tr','td','th','caption','hr','h1','h2','h3','h4','h5','h6','img','a','pre','code','math','mrow','mi','mn','mo','mtext','mfrac','msqrt','mroot','msup','msub','msubsup','mover','munder','munderover','mtable','mtr','mtd','semantics','annotation'];
            foreach($document->getElementsByTagName('*') as $element) {
                $tag=strtolower($element->tagName);
                if(!in_array($tag,$allowed,true)) throw new InvalidArgumentException('Elemento HTML exige revisao: '.$tag);
                foreach($element->attributes as $attribute) {
                    $name=strtolower($attribute->name);
                    $value=trim($attribute->value);
                    if(in_array($name,['alt','title','lang','dir','colspan','rowspan','scope','start','type','display','mathvariant','encoding'],true))continue;
                    if(in_array($name,['width','height'],true) && preg_match('/^[0-9]{1,5}%?$/',$value))continue;
                    if($name==='xmlns' && $value==='http://www.w3.org/1998/Math/MathML')continue;
                    if($tag==='img' && $name==='src' && in_array($value,$mediaUrls,true))continue;
                    if($tag==='a' && $name==='href' && filter_var($value,FILTER_VALIDATE_URL)
                        && in_array(strtolower((string)parse_url($value,PHP_URL_SCHEME)),['http','https'],true))continue;
                    throw new InvalidArgumentException('Atributo HTML exige revisao: '.$tag.'.'.$name);
                }
            }
        } finally { libxml_clear_errors();libxml_use_internal_errors($previous); }
    }
}
